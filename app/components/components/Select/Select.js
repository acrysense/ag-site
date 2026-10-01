import SimpleBar from 'simplebar'
import { announce } from '@/utils/announce'
import { isSheet, lockIfSheet } from '@/utils/sheet'
import { createIcon } from '@/utils/icon'

// Выпадающий список. Без JS работает нативный <select> прозрачным слоем поверх поля. Здесь он
// заменяется списком по макету (шаблон WAI-ARIA «combobox + listbox»): активный пункт —
// aria-activedescendant, выбор пишется в <select> и вызывает у него change, поэтому форма и
// автоотправка (data-select-submit) работают как с нативным списком.
//
// multiple — выбор нескольких: пункт переключается, список не закрывается; в поле —
// «<placeholder>: N». С data-select-submit форма уходит один раз — при закрытии, если выбор
// менялся (фильтр не перезагружает страницу на каждый пункт).
//
// Режимы:
// - пункты из <option> (по умолчанию); с data-select-search — поиск по ним без запросов;
// - data-select-url — пункты с сервера. Бэк бережём: ничего не грузим, пока список не открыли;
//   поиск — через 300 мс после ввода и от minChars символов; прошлый запрос отменяется;
//   ответы кешируются по запросу; следующая порция — при прокрутке к концу, по одному
//   запросу за раз. Формат ответа — docs/contracts/select.md.
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

const checkIcon = () => createIcon('check', 'select__check')

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
	const multiple = select.multiple
	const placeholder = value.dataset.placeholder || ''
	const submits = select.hasAttribute('data-select-submit')
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
	let dirty = false // multiple: выбор менялся, пока список открыт
	let pinned = new Set() // multiple: выбранные на момент открытия — стоят сверху
	let release = null // блокировка прокрутки страницы под нижним листом
	const cache = new Map()

	const fromOptions = () =>
		[...select.options].map((option) => ({
			value: option.value,
			text: option.textContent.trim(),
		}))

	const isSelected = (itemValue) =>
		[...select.selectedOptions].some((option) => option.value === itemValue)

	// Текст поля: выбранный пункт; у multiple — «Отдел: 2»; ничего не выбрано — заглушка серым
	const sync = () => {
		const count = select.selectedOptions.length
		const empty = multiple ? !count : !select.value && Boolean(placeholder)
		if (empty) value.textContent = placeholder
		else if (multiple)
			value.textContent = placeholder
				? `${placeholder}: ${count}`
				: [...select.selectedOptions].map((option) => option.textContent.trim()).join(', ')
		else value.textContent = select.selectedOptions[0]?.textContent ?? ''
		root.classList.toggle('is-placeholder', empty)
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

	// multiple (фильтры, Figma: Dropdown List — с поиском 4764:2732): пункты с флажками, выбранные —
	// сверху, под чертой — остальные. На мобильном окно — нижний лист (4786:2839): заголовок, ×,
	// поиск, список и «Готово»; шапка, «Готово» и затемнение на десктопе скрыты стилями
	let backdrop = null
	const closers = []
	if (multiple) {
		root.classList.add('select--multi')
		const head = document.createElement('div')
		head.className = 'select__sheet-head'
		const title = document.createElement('p')
		title.className = 'select__sheet-title'
		title.textContent = placeholder || label?.textContent || ''
		const x = document.createElement('button')
		x.type = 'button'
		x.className = 'select__sheet-close'
		x.setAttribute('aria-label', 'Закрыть')
		x.append(createIcon('close', 'select__sheet-close-icon'))
		head.append(title, x)
		popup.append(head)
		backdrop = document.createElement('div')
		backdrop.className = 'select__backdrop'
		backdrop.hidden = true
		closers.push(x, backdrop)
	}

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
	if (multiple) list.setAttribute('aria-multiselectable', 'true')
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
	if (multiple) {
		const done = document.createElement('button')
		done.type = 'button'
		done.className = 'btn btn--general btn--m select__done'
		done.textContent = 'Готово'
		popup.append(done)
		closers.push(done)
		root.append(backdrop)
	}
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
		list.querySelectorAll('.select__option').forEach((option) => {
			option.classList.toggle('is-active', Number(option.dataset.index) === active)
		})
		const current = optionAt(active)
		if (current) {
			target.setAttribute('aria-activedescendant', current.id)
			if (scroll) current.scrollIntoView({ block: 'nearest' })
		} else target.removeAttribute('aria-activedescendant')
	}

	const optionAt = (index) => list.querySelector(`.select__option[data-index="${index}"]`)

	const renderItems = () => {
		const options = items.map((item, index) => {
			const option = document.createElement('li')
			option.className = 'select__option'
			option.id = `${id}-option-${index}`
			option.dataset.index = String(index)
			option.setAttribute('role', 'option')
			option.setAttribute(
				'aria-selected',
				String(
					multiple
						? isSelected(item.value)
						: item.value === select.value && select.selectedIndex >= 0
				)
			)
			const text = document.createElement('span')
			text.className = 'select__option-text'
			text.textContent = item.text
			if (multiple) {
				const box = document.createElement('span')
				box.className = 'select__box'
				box.append(checkIcon())
				option.append(box, text)
			} else option.append(text, checkIcon())
			return option
		})
		// Черта между выбранными (сверху) и остальными
		const split = multiple ? items.findIndex((item) => !pinned.has(item.value)) : -1
		if (split > 0) {
			const divider = document.createElement('li')
			divider.className = 'select__divider'
			divider.setAttribute('role', 'presentation')
			options.splice(split, 0, divider)
		}
		list.replaceChildren(...options)
		if (remoteUrl) list.append(sentinel)
		if (active >= items.length) active = items.length - 1
		renderActive()
	}

	// Пункты без сервера: все или найденные по тексту
	const filterLocal = () => {
		const q = query.trim().toLowerCase()
		items = fromOptions().filter((item) => !q || item.text.toLowerCase().includes(q))
		if (multiple)
			items = [
				...items.filter((item) => pinned.has(item.value)),
				...items.filter((item) => !pinned.has(item.value)),
			]
		setStatus(items.length ? 'ready' : 'empty')
		active = items.length ? 0 : -1
		if (!q && !multiple) active = Math.max(select.selectedIndex, 0)
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
		if (backdrop) backdrop.hidden = false
		pointer = { x: null, y: null }
		pinned = new Set([...select.selectedOptions].map((option) => option.value))
		root.classList.add('is-open')
		if (multiple) release = lockIfSheet()
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
		// Мало места снизу — окно открывается вверх (нижний лист — всегда снизу)
		if (!(multiple && isSheet())) {
			const rect = field.getBoundingClientRect()
			const below = window.innerHeight - rect.bottom
			root.classList.toggle('is-up', below < popup.offsetHeight + 12 && rect.top > below)
		}
		input?.focus()
	}

	const close = ({ focus = false } = {}) => {
		if (!isOpen()) return
		popup.hidden = true
		popup.classList.remove('is-keys')
		if (backdrop) backdrop.hidden = true
		release?.()
		release = null
		root.classList.remove('is-open', 'is-up')
		button.setAttribute('aria-expanded', 'false')
		active = -1
		renderActive()
		if (focus) button.focus()
		// multiple: выбор закончен — событие select:commit (фильтры применяются один раз)
		if (multiple && dirty) {
			select.dispatchEvent(new CustomEvent('select:commit', { bubbles: true }))
			if (submits) select.form?.requestSubmit()
		}
		dirty = false
	}

	const choose = (index) => {
		const item = items[index]
		if (!item) return
		let option = [...select.options].find((candidate) => candidate.value === item.value)
		if (!option) {
			option = new Option(item.text, item.value)
			select.append(option)
		}
		// multiple: пункт переключается, список остаётся открытым
		if (multiple) {
			option.selected = !option.selected
			dirty = true
			sync()
			optionAt(index)?.setAttribute('aria-selected', String(option.selected))
			select.dispatchEvent(new Event('change', { bubbles: true }))
			return
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
			// Пункт под стрелками подсвечивается, только когда листают с клавиатуры
			if (key !== 'Enter' && key !== 'Escape') popup.classList.add('is-keys')
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
			popup.classList.remove('is-keys')
			if (!moved) return
			const option = event.target.closest('.select__option')
			const index = Number(option?.dataset.index)
			if (option && index !== active) move(index, { scroll: false })
		},
		{ signal }
	)
	list.addEventListener(
		'click',
		(event) => {
			const option = event.target.closest('.select__option')
			if (option) choose(Number(option.dataset.index))
		},
		{ signal }
	)

	closers.forEach((el) => el.addEventListener('click', () => close({ focus: true }), { signal }))

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
			if (submits && !multiple) select.form?.requestSubmit()
		},
		{ signal }
	)

	// Сброс формы: событие reset приходит до очистки полей — подпись обновляем следом
	let resetTimer = 0
	select.form?.addEventListener(
		'reset',
		() => {
			clearTimeout(resetTimer)
			resetTimer = setTimeout(sync)
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
		clearTimeout(resetTimer)
		release?.()
		simplebar.unMount()
		button.remove()
		popup.remove()
		backdrop?.remove()
		select.removeAttribute('tabindex')
		select.removeAttribute('aria-hidden')
		root.classList.remove(
			'is-enhanced',
			'is-open',
			'is-up',
			'is-loading',
			'is-placeholder',
			'select--multi'
		)
	}
}
