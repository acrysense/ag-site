import SimpleBar from 'simplebar'
import { announce } from '@/utils/announce'

// Выпадающий список. Без JS работает нативный <select> прозрачным слоем поверх поля. Здесь он
// заменяется списком по макету (шаблон WAI-ARIA «combobox + listbox»): активный пункт —
// aria-activedescendant, выбор пишется в <select> и вызывает у него change, поэтому форма и
// автоотправка (data-select-submit) работают как с нативным списком.
//
// Режимы:
// - пункты из <option> (по умолчанию); с data-select-search — поиск по ним без запросов;
// - data-select-url — пункты с сервера. Бэк бережём: ничего не грузим, пока список не открыли;
//   поиск — через 300 мс после ввода и от minChars символов; прошлый запрос отменяется;
//   ответы кешируются по запросу; следующая порция — при прокрутке к концу, по одному
//   запросу за раз. Формат ответа — docs/contracts/select.md.
const SVG = 'http://www.w3.org/2000/svg'
const DEBOUNCE = 300
const CACHE_LIMIT = 30
const TEXT = {
	loading: 'Загрузка…',
	empty: 'Ничего не найдено',
	error: 'Не удалось загрузить',
	retry: 'Повторить',
	search: 'Поиск',
	hint: (n) => `Введите от ${n} символов`,
	found: (n) => `Найдено: ${n}`,
}
let counter = 0

const checkIcon = () => {
	const svg = document.createElementNS(SVG, 'svg')
	svg.setAttribute('class', 'icon select__check')
	svg.setAttribute('aria-hidden', 'true')
	svg.setAttribute('focusable', 'false')
	const use = document.createElementNS(SVG, 'use')
	use.setAttribute('href', '#icon-check')
	svg.append(use)
	return svg
}

// bitrix_sessid: из ядра Битрикса, если оно на странице (запрос только читает, но заголовок
// не мешает и нужен, если бэк проверяет его для всех AJAX)
const sessid = () => window.BX?.bitrix_sessid?.() || ''

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const field = root.querySelector('.select__field')
	const select = root.querySelector('select')
	const value = root.querySelector('[data-select-value]')
	const label = root.querySelector('.select__label')
	if (!field || !select || !value) return () => controller.abort()

	const remoteUrl = root.dataset.selectUrl || ''
	const searchable = root.hasAttribute('data-select-search')
	const minChars = Math.max(1, Number(root.dataset.selectMinChars) || 2)
	const id = `select-${++counter}`

	let items = []
	let active = -1
	let query = ''
	let next = null
	let status = 'ready' // ready | loading | empty | error | hint
	let request = null
	let loaded = false
	let debounceTimer = 0
	let typed = ''
	let typedTimer = 0
	let pointer = { x: null, y: null }
	const cache = new Map()

	const fromOptions = () =>
		[...select.options].map((option) => ({
			value: option.value,
			text: option.textContent.trim(),
		}))

	const sync = () => {
		value.textContent = select.selectedOptions[0]?.textContent ?? ''
	}

	// Разметка: кнопка поверх поля, окно со строкой поиска, списком и строкой состояния
	if (label) label.id = `${id}-label`
	value.id = `${id}-value`
	const labelledby = `${label ? `${id}-label ` : ''}${id}-value`

	const button = document.createElement('button')
	button.type = 'button'
	button.className = 'select__button'
	button.setAttribute('aria-haspopup', 'listbox')
	button.setAttribute('aria-expanded', 'false')
	button.setAttribute('aria-controls', `${id}-list`)
	button.setAttribute('aria-labelledby', labelledby)
	if (!searchable) button.setAttribute('role', 'combobox')

	const popup = document.createElement('div')
	popup.className = 'select__popup'
	popup.hidden = true

	let input = null
	if (searchable) {
		input = document.createElement('input')
		input.type = 'search'
		input.className = 'select__search'
		input.placeholder = root.dataset.selectSearchPlaceholder || TEXT.search
		input.autocomplete = 'off'
		input.spellcheck = false
		input.setAttribute('role', 'combobox')
		input.setAttribute('aria-autocomplete', 'list')
		input.setAttribute('aria-expanded', 'true')
		input.setAttribute('aria-controls', `${id}-list`)
		input.setAttribute('aria-labelledby', labelledby)
		popup.append(input)
	}

	const list = document.createElement('ul')
	list.className = 'select__list'
	list.id = `${id}-list`
	list.setAttribute('role', 'listbox')
	if (label) list.setAttribute('aria-labelledby', `${id}-label`)

	// Метка конца списка: видна — пора грузить следующую порцию
	const sentinel = document.createElement('li')
	sentinel.className = 'select__sentinel'
	sentinel.setAttribute('role', 'presentation')
	sentinel.setAttribute('aria-hidden', 'true')

	const statusBox = document.createElement('div')
	statusBox.className = 'select__status'
	statusBox.hidden = true

	// Прокрутка — SimpleBar: окно не выше ~7 пунктов, полоса по макету, а не системная
	const scroll = document.createElement('div')
	scroll.className = 'select__scroll'
	popup.append(scroll, statusBox)
	root.append(popup)
	const simplebar = new SimpleBar(scroll, {
		autoHide: false,
		ariaLabel: label?.textContent || '',
	})
	const scroller = simplebar.getScrollElement()
	simplebar.getContentElement().append(list)

	// Элемент с фокусом, пока окно открыто
	const focusTarget = () => input || button

	const isOpen = () => !popup.hidden

	// Состояние
	const setStatus = (state) => {
		status = state
		statusBox.replaceChildren()
		statusBox.hidden = state === 'ready'
		root.classList.toggle('is-loading', state === 'loading')
		if (state === 'loading') statusBox.textContent = TEXT.loading
		if (state === 'empty') statusBox.textContent = TEXT.empty
		if (state === 'hint') statusBox.textContent = TEXT.hint(minChars)
		if (state === 'error') {
			const text = document.createElement('span')
			text.textContent = TEXT.error
			const retry = document.createElement('button')
			retry.type = 'button'
			retry.className = 'select__retry'
			retry.textContent = TEXT.retry
			retry.addEventListener('click', () => load({ append: items.length > 0 }), { signal })
			statusBox.append(text, retry)
		}
	}

	const renderActive = ({ scroll = true } = {}) => {
		const target = focusTarget()
		list.querySelectorAll('.select__option').forEach((option, index) => {
			option.classList.toggle('is-active', index === active)
		})
		const current = list.children[active]
		if (current && current !== sentinel) {
			target.setAttribute('aria-activedescendant', current.id)
			if (scroll) current.scrollIntoView({ block: 'nearest' })
		} else target.removeAttribute('aria-activedescendant')
	}

	const renderItems = () => {
		const options = items.map((item, index) => {
			const option = document.createElement('li')
			option.className = 'select__option'
			option.id = `${id}-option-${index}`
			option.setAttribute('role', 'option')
			option.setAttribute(
				'aria-selected',
				String(item.value === select.value && select.selectedIndex >= 0)
			)
			const text = document.createElement('span')
			text.textContent = item.text
			option.append(text, checkIcon())
			return option
		})
		list.replaceChildren(...options)
		if (remoteUrl) list.append(sentinel)
		if (active >= items.length) active = items.length - 1
		renderActive()
	}

	// Пункты без сервера: все или найденные по тексту
	const filterLocal = () => {
		const q = query.trim().toLowerCase()
		items = fromOptions().filter((item) => !q || item.text.toLowerCase().includes(q))
		setStatus(items.length ? 'ready' : 'empty')
		active = items.length ? 0 : -1
		if (!q) active = Math.max(select.selectedIndex, 0)
		renderItems()
	}

	const remember = (key, entry) => {
		cache.delete(key)
		cache.set(key, entry)
		if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value)
	}

	// Пункты с сервера: первая порция по запросу или следующая (append)
	const load = async ({ append = false } = {}) => {
		const q = query.trim()
		if (!append) {
			request?.abort()
			request = null
			if (q.length > 0 && q.length < minChars) {
				items = []
				next = null
				active = -1
				setStatus('hint')
				renderItems()
				return
			}
			const hit = cache.get(q)
			if (hit) {
				items = hit.items
				next = hit.next
				active = items.length ? 0 : -1
				setStatus(items.length ? 'ready' : 'empty')
				renderItems()
				return
			}
		} else if (!next || request) return

		const own = new AbortController()
		request = own
		setStatus('loading')
		if (!append) {
			items = []
			active = -1
			renderItems()
		}

		const url = new URL(remoteUrl, window.location.href)
		if (q) url.searchParams.set('q', q)
		if (append && next) url.searchParams.set('cursor', next)
		const headers = { Accept: 'application/json' }
		if (sessid()) headers['X-Bitrix-Csrf-Token'] = sessid()

		try {
			const response = await fetch(url, {
				signal: own.signal,
				headers,
				credentials: 'same-origin',
			})
			if (!response.ok) throw new Error(`HTTP ${response.status}`)
			const data = await response.json()
			if (own.signal.aborted || signal.aborted) return
			const page = (Array.isArray(data?.items) ? data.items : [])
				.filter((item) => item && item.value !== undefined && item.value !== null)
				.map((item) => ({
					value: String(item.value),
					text: String(item.text ?? item.value),
				}))
			items = append ? items.concat(page) : page
			next = data?.next ? String(data.next) : null
			loaded = true
			remember(q, { items, next })
			if (!append) active = items.length ? 0 : -1
			setStatus(items.length ? 'ready' : 'empty')
			renderItems()
			if (!append) announce(items.length ? TEXT.found(items.length) : TEXT.empty)
			request = null
			// Порция короче окна — метка конца видна сразу, грузим следующую
			if (next && scroller.scrollHeight <= scroller.clientHeight + 1) load({ append: true })
		} catch (error) {
			if (own.signal.aborted || signal.aborted) return
			request = null
			setStatus('error')
			announce(TEXT.error)
		}
	}

	const observer = remoteUrl
		? new IntersectionObserver(
				(entries) => {
					if (entries.some((entry) => entry.isIntersecting) && isOpen())
						load({ append: true })
				},
				{ root: scroller, rootMargin: '0px 0px 80px 0px' }
			)
		: null
	observer?.observe(sentinel)

	const refresh = () => (remoteUrl ? load() : filterLocal())

	const open = () => {
		if (isOpen()) return
		popup.hidden = false
		pointer = { x: null, y: null }
		root.classList.add('is-open')
		simplebar.recalculate()
		button.setAttribute('aria-expanded', 'true')
		if (remoteUrl && !loaded && status !== 'loading') refresh()
		else if (!remoteUrl) filterLocal()
		else {
			active = Math.max(
				items.findIndex((item) => item.value === select.value),
				0
			)
			renderActive()
		}
		// Мало места снизу — окно открывается вверх
		const rect = field.getBoundingClientRect()
		const below = window.innerHeight - rect.bottom
		root.classList.toggle('is-up', below < popup.offsetHeight + 12 && rect.top > below)
		input?.focus()
	}

	const close = ({ focus = false } = {}) => {
		if (!isOpen()) return
		popup.hidden = true
		root.classList.remove('is-open', 'is-up')
		button.setAttribute('aria-expanded', 'false')
		active = -1
		renderActive()
		if (focus) button.focus()
	}

	const choose = (index) => {
		const item = items[index]
		if (!item) return
		let option = [...select.options].find((candidate) => candidate.value === item.value)
		if (!option) {
			option = new Option(item.text, item.value)
			select.append(option)
		}
		const changed = !option.selected
		option.selected = true
		sync()
		close({ focus: true })
		if (changed) select.dispatchEvent(new Event('change', { bubbles: true }))
	}

	const move = (index, { scroll = true } = {}) => {
		if (!items.length) return
		active = Math.min(Math.max(index, 0), items.length - 1)
		renderActive({ scroll })
	}

	// Без поиска: набор букв — к первому пункту, который начинается с них
	const typeahead = (key) => {
		clearTimeout(typedTimer)
		typed += key.toLowerCase()
		typedTimer = setTimeout(() => (typed = ''), 500)
		const all = fromOptions()
		const start = Math.max(active, select.selectedIndex, 0)
		const order = all.map((_, i) => (start + 1 + i) % all.length)
		const match = order.find((i) => all[i].text.toLowerCase().startsWith(typed))
		if (match === undefined) return
		if (isOpen()) move(match)
		else {
			items = all
			choose(match)
		}
	}

	const onKey = (event) => {
		const { key } = event
		const printable = key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
		if (!isOpen()) {
			if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
				event.preventDefault()
				open()
			} else if (printable && searchable) {
				// Первая буква — сразу в строку поиска
				event.preventDefault()
				open()
				input.value = key
				input.dispatchEvent(new Event('input'))
			} else if (printable) typeahead(key)
			return
		}
		const actions = {
			ArrowDown: () => move(active + 1),
			ArrowUp: () => move(active - 1),
			PageDown: () => move(active + 10),
			PageUp: () => move(active - 10),
			Enter: () => choose(active),
			Escape: () => close({ focus: true }),
		}
		// В строке поиска Home, End и пробел — для текста
		if (!searchable) {
			Object.assign(actions, {
				Home: () => move(0),
				End: () => move(items.length - 1),
				' ': () => choose(active),
			})
		}
		if (actions[key]) {
			event.preventDefault()
			actions[key]()
		} else if (key === 'Tab') {
			close()
		} else if (printable && !searchable) typeahead(key)
	}

	button.addEventListener('click', () => (isOpen() ? close() : open()), { signal })
	button.addEventListener('keydown', onKey, { signal })
	input?.addEventListener('keydown', onKey, { signal })

	input?.addEventListener(
		'input',
		() => {
			query = input.value
			clearTimeout(debounceTimer)
			if (!remoteUrl) {
				filterLocal()
				return
			}
			// На сервер — после паузы в наборе
			debounceTimer = setTimeout(load, DEBOUNCE)
		},
		{ signal }
	)

	// Мышь: пункт подсвечивается при наведении, выбор — по клику; mousedown без смены фокуса
	popup.addEventListener(
		'mousedown',
		(event) => {
			if (event.target !== input) event.preventDefault()
		},
		{ signal }
	)
	list.addEventListener(
		'mousemove',
		(event) => {
			// Только настоящее движение мыши: при появлении списка под курсором браузер тоже
			// шлёт mousemove — он не должен сбивать выбранный пункт и прокрутку
			if (event.clientX === pointer.x && event.clientY === pointer.y) return
			const moved = pointer.x !== null
			pointer = { x: event.clientX, y: event.clientY }
			if (!moved) return
			const option = event.target.closest('.select__option')
			const index = [...list.children].indexOf(option)
			if (option && index !== active) move(index, { scroll: false })
		},
		{ signal }
	)
	list.addEventListener(
		'click',
		(event) => {
			const option = event.target.closest('.select__option')
			if (option) choose([...list.children].indexOf(option))
		},
		{ signal }
	)

	document.addEventListener(
		'pointerdown',
		(event) => {
			if (!root.contains(event.target)) close()
		},
		{ signal }
	)
	root.addEventListener(
		'focusout',
		(event) => {
			if (!root.contains(event.relatedTarget)) close()
		},
		{ signal }
	)

	select.addEventListener(
		'change',
		() => {
			sync()
			if (select.hasAttribute('data-select-submit')) select.form?.requestSubmit()
		},
		{ signal }
	)

	// Нативный список остаётся для формы, но убирается из фокуса и от скринридера
	select.tabIndex = -1
	select.setAttribute('aria-hidden', 'true')
	field.append(button)
	root.classList.add('is-enhanced')
	sync()

	return () => {
		controller.abort()
		request?.abort()
		observer?.disconnect()
		clearTimeout(debounceTimer)
		clearTimeout(typedTimer)
		simplebar.unMount()
		button.remove()
		popup.remove()
		select.removeAttribute('tabindex')
		select.removeAttribute('aria-hidden')
		root.classList.remove('is-enhanced', 'is-open', 'is-up', 'is-loading')
	}
}
