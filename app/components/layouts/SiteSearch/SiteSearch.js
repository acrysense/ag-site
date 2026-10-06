import { announce } from '@/utils/announce'
import { lockBody } from '@/utils/scroll-lock'
import { revealInRow } from '@/utils/reveal-in-row'
import { createIcon as icon } from '@/utils/icon'
import { skeleton, skeletonLines } from '@/utils/skeleton'

// Поиск в шапке (контракт — docs/contracts/site-search.md).
// - Фокус в поле — окно: разделы (радиокнопки section), фильтры раздела, подсказки. До 1024 окно
//   на весь экран (таб-бар под ним), страница не прокручивается.
// - Раздел: фильтры приходят с filtersUrl (HTML) — пока ждём, скелетон; запрос сохраняется,
//   фильтры прошлого раздела не переносятся.
// - Подсказки: с 2-го символа, через 300 мс после ввода, прошлый запрос отменяется; до 6 штук.
//   Фильтр изменили — подсказки и число пересчитываются сразу. ↑↓ — по подсказкам, Enter —
//   открыть выбранную или все результаты (страница результатов с теми же фильтрами).
// - Без фокуса: в поле запрос и сводка «Справочник · 2 фильтра», × на ней сбрасывает фильтры.
// - Подсказки — JSON (рисуем сами: текст через textContent, в названии разрешён только <mark>)
//   или HTML-фрагмент из шаблона компонента поиска на бэке (arturgolubev:search.title и т. п.)
//   с пунктами .site-search__item — удобно для «Умного поиска» без отдельного API.
const DESKTOP = '(min-width: 1024px)'
const MIN_CHARS = 2
const DELAY = 300
const PREVIEW_ICONS = {
	person: ['profile', 'l'],
	news: ['news', 'l'],
	vacancy: ['case', 'l'],
	document: ['document', ''],
	other: ['chain', ''],
}

const plural = (n, one, few, many) => {
	const mod10 = n % 10
	const mod100 = n % 100
	if (mod10 === 1 && mod100 !== 11) return one
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
	return many
}

const escapeHtml = (value) =>
	String(value ?? '').replace(
		/[&<>"']/g,
		(char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
	)
// Разрешён только <mark>: всё экранируем и возвращаем метки совпадений
const markOnly = (html) => escapeHtml(html).replace(/&lt;(\/?)mark&gt;/g, '<$1mark>')

let counter = 0

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const form = root.querySelector('form')
	const input = root.querySelector('[data-site-search-input]')
	const panel = root.querySelector('[data-site-search-panel]')
	const filterList = root.querySelector('[data-site-search-filter-list]')
	const results = root.querySelector('[data-site-search-results]')
	const list = root.querySelector('[data-site-search-list]')
	const info = root.querySelector('[data-site-search-info]')
	const empty = root.querySelector('[data-site-search-empty]')
	const emptyTitle = root.querySelector('[data-site-search-empty-title]')
	const allButton = root.querySelector('[data-site-search-all]')
	const footer = root.querySelector('[data-site-search-footer]')
	const apply = root.querySelector('[data-site-search-apply]')
	const chip = root.querySelector('[data-site-search-chip]')
	const chipText = root.querySelector('[data-site-search-chip-text]')
	const clear = root.querySelector('[data-site-search-clear]')
	const summary = root.querySelector('[data-site-search-summary]')
	const summaryText = root.querySelector('[data-site-search-summary-text]')
	const sectionLabel = root.querySelector('[data-site-search-section-label]')
	const sectionList = root.querySelector('.site-search__section-list')
	if (!form || !input || !panel) return () => controller.abort()

	const suggestUrl = root.dataset.suggestUrl || ''
	const filtersUrl = root.dataset.filtersUrl || ''
	const media = window.matchMedia(DESKTOP)
	const id = `site-search-${++counter}`
	let release = null
	let suggestTimer = 0
	let suggestRequest = null
	let filtersRequest = null
	let items = []
	let active = -1
	let count = 0

	input.setAttribute('role', 'combobox')
	input.setAttribute('aria-autocomplete', 'list')
	input.setAttribute('aria-expanded', 'false')
	input.setAttribute('aria-controls', list?.id || '')

	const isOpen = () => root.classList.contains('is-open')
	const isFull = () => !media.matches
	const query = () => input.value.trim()
	const currentSection = () => form.querySelector('input[name="section"]:checked')
	const sectionName = () => currentSection()?.dataset.label || ''

	// ---------- Фильтры: сколько выбрано, сводки ----------

	const activeFilters = () =>
		[...filterList.querySelectorAll('.search-filter')].filter((filter) => {
			const select = filter.querySelector('select')
			if (select)
				return (
					select.selectedOptions.length > 0 &&
					[...select.selectedOptions].some((o) => o.value)
				)
			return [...filter.querySelectorAll('input')].some((field) => field.value.trim() !== '')
		})

	const filterText = (filter) => {
		const value = filter.querySelector('.select__value, .date-range__value')
		if (value) return value.textContent.trim()
		const fields = [...filter.querySelectorAll('input')].map((field) => field.value.trim())
		const label = filter.querySelector('[role="group"]')?.getAttribute('aria-label') || ''
		return `${label}: ${fields[0] || '…'} — ${fields[1] || '…'}`
	}

	const updateSummaries = () => {
		const chosen = activeFilters()
		const n = chosen.length
		chipText.textContent = n
			? `${sectionName()} · ${n} ${plural(n, 'фильтр', 'фильтра', 'фильтров')}`
			: ''
		chip.setAttribute('aria-label', `Сбросить фильтры: ${chipText.textContent}`)
		chip.hidden = !n || isOpen()
		summaryText.textContent = n ? `Фильтры: ${chosen.map(filterText).join(', ')}` : 'Фильтры'
		root.classList.toggle('has-filters', n > 0)
		root.querySelectorAll('.site-search__empty-reset').forEach((el) => (el.hidden = !n))
		updateApply()
	}

	// Фильтры выбраны, а запроса нет — кнопка «Найти в разделе» (с запросом — «Все результаты»)
	const updateApply = () => {
		if (!apply) return
		const show = query().length < MIN_CHARS && activeFilters().length > 0
		apply.hidden = !show
		if (show)
			apply.firstElementChild.textContent = `Найти ${currentSection()?.dataset.where || `в разделе «${sectionName()}»`}`
	}

	const resetFilters = () => {
		filterList.querySelectorAll('select').forEach((select) => {
			;[...select.options].forEach((option) => (option.selected = false))
			select.dispatchEvent(new Event('change', { bubbles: true }))
		})
		filterList.querySelectorAll('input').forEach((field) => {
			if (!field.value) return
			field.value = ''
			field.dispatchEvent(new Event('change', { bubbles: true }))
		})
		updateSummaries()
		scheduleSuggest(0)
	}

	// ---------- Подсказки ----------

	const params = () => {
		const search = new URLSearchParams()
		for (const [key, value] of new FormData(form))
			if (String(value).trim() !== '') search.append(key, value)
		return search
	}

	const setActive = (index) => {
		active = index
		const options = [...list.querySelectorAll('[role="option"]')]
		options.forEach((option, i) => option.classList.toggle('is-active', i === active))
		const current = options[active]
		if (current) {
			input.setAttribute('aria-activedescendant', current.id)
			current.scrollIntoView({ block: 'nearest' })
		} else input.removeAttribute('aria-activedescendant')
	}

	const renderItem = (item) => {
		const li = document.createElement('li')
		const link = document.createElement('a')
		link.className = 'site-search__link'
		link.href = item.url || '#'
		const preview = document.createElement('span')
		const type = PREVIEW_ICONS[item.type] ? item.type : 'other'
		preview.className = `site-search__preview site-search__preview--${type}`
		if (item.image) {
			const img = document.createElement('img')
			img.className = 'site-search__image'
			img.src = item.image
			img.alt = ''
			img.width = 40
			img.height = 40
			img.loading = 'lazy'
			preview.append(img)
		} else {
			const [name, size] = PREVIEW_ICONS[type]
			preview.append(
				icon(
					name,
					`site-search__preview-icon${size ? ` site-search__preview-icon--${size}` : ''}`
				)
			)
		}
		const text = document.createElement('span')
		text.className = 'site-search__text'
		const title = document.createElement('span')
		title.className = 'site-search__title'
		title.innerHTML = markOnly(item.titleHtml ?? escapeHtml(item.title))
		const meta = document.createElement('span')
		meta.className = 'site-search__meta'
		meta.textContent = item.meta || ''
		text.append(title, meta)
		link.append(preview, text)
		li.append(link)
		return li
	}

	// Готовые пункты (из JSON или HTML бэка) — в список; число — для «Все результаты · N»
	const renderResults = (nodes, total) => {
		items = nodes.slice(0, 6)
		count = Math.max(0, Number(total) || items.length)
		items.forEach((li, index) => {
			li.id = `${id}-option-${index}`
			li.classList.add('site-search__item')
			li.setAttribute('role', 'option')
			li.setAttribute('aria-selected', 'false')
			li.querySelectorAll('a').forEach((link) => (link.tabIndex = -1))
		})
		const section = sectionName()
		info.textContent = `${section} · найдено ${count}`
		list.replaceChildren(...items)
		list.hidden = !items.length
		info.hidden = !items.length
		empty.hidden = items.length > 0
		footer.hidden = !items.length
		emptyTitle.textContent = `По запросу «${query()}» ничего не найдено`
		allButton.replaceChildren(
			'Все результаты',
			Object.assign(document.createElement('span'), {
				className: 'site-search__all-in',
				textContent: ` ${currentSection()?.dataset.where || `в разделе «${section}»`}`,
			}),
			` · ${count}`
		)
		active = -1
		input.removeAttribute('aria-activedescendant')
		announce(items.length ? `${section}: найдено ${count}` : emptyTitle.textContent)
	}

	// Ответ JSON — рисуем пункты сами; HTML — шаблон компонента поиска на бэке (например,
	// arturgolubev:search.title) уже отдал пункты .site-search__item и число в data-suggest-count
	const parseResponse = async (response) => {
		const type = response.headers.get('Content-Type') || ''
		if (type.includes('json')) {
			const data = await response.json()
			const list = Array.isArray(data?.items) ? data.items : []
			return { nodes: list.slice(0, 6).map(renderItem), total: data?.count }
		}
		const template = document.createElement('template')
		template.innerHTML = await response.text()
		const nodes = [...template.content.querySelectorAll('.site-search__item')]
		const total = template.content.querySelector('[data-suggest-count]')?.dataset.suggestCount
		return { nodes, total }
	}

	const showResults = (show) => {
		results.hidden = !show
		root.classList.toggle('has-query', show)
		if (!show) {
			list.replaceChildren()
			items = []
			active = -1
			input.removeAttribute('aria-activedescendant')
		}
	}

	// Первый запрос (подсказок ещё нет) — заготовки пунктов; дальше старые подсказки остаются,
	// пока не придут новые
	const suggestSkeleton = () => {
		const li = document.createElement('li')
		li.className = 'site-search__item site-search__item--skeleton'
		li.setAttribute('aria-hidden', 'true')
		const row = document.createElement('span')
		row.className = 'site-search__link'
		row.append(skeleton('media', 'site-search__preview'), skeletonLines(2, 'site-search__text'))
		li.append(row)
		return li
	}

	const suggest = async () => {
		if (query().length < MIN_CHARS || !suggestUrl) {
			suggestRequest?.abort()
			showResults(false)
			return
		}
		suggestRequest?.abort()
		const own = new AbortController()
		suggestRequest = own
		results.setAttribute('aria-busy', 'true')
		if (!items.length) {
			showResults(true)
			list.replaceChildren(...Array.from({ length: 3 }, suggestSkeleton))
			list.hidden = false
			info.hidden = true
			empty.hidden = true
			footer.hidden = true
		}
		const url = new URL(suggestUrl, window.location.href)
		params().forEach((value, key) => url.searchParams.append(key, value))
		// Как у стандартного bitrix:search.title — бэк отличает AJAX-запрос подсказок
		url.searchParams.set('ajax_call', 'y')
		try {
			const response = await fetch(url, {
				signal: own.signal,
				headers: { Accept: 'application/json' },
				credentials: 'same-origin',
			})
			if (!response.ok) throw new Error(`HTTP ${response.status}`)
			const { nodes, total } = await parseResponse(response)
			if (own.signal.aborted || signal.aborted) return
			showResults(true)
			renderResults(nodes, total)
		} catch {
			if (own.signal.aborted || signal.aborted) return
			showResults(true)
			items = []
			list.replaceChildren()
			empty.hidden = true
			footer.hidden = false
			info.hidden = false
			info.textContent = 'Подсказки не загрузились — откройте все результаты'
			allButton.textContent = 'Все результаты'
		} finally {
			if (suggestRequest === own) {
				suggestRequest = null
				results.removeAttribute('aria-busy')
			}
		}
	}

	const scheduleSuggest = (delay = DELAY) => {
		clearTimeout(suggestTimer)
		suggestTimer = setTimeout(suggest, delay)
	}

	// ---------- Разделы: фильтры с сервера ----------

	const fieldSkeletons = (n) => Array.from({ length: n }, () => skeleton('field'))

	const loadFilters = async (section) => {
		filtersRequest?.abort()
		const own = new AbortController()
		filtersRequest = own
		sectionLabel.textContent = sectionName()
		filterList.setAttribute('aria-busy', 'true')
		filterList.replaceChildren(...fieldSkeletons(Math.max(2, filterList.children.length || 2)))
		updateSummaries()
		try {
			let html = ''
			if (filtersUrl) {
				const url = new URL(filtersUrl, window.location.href)
				url.searchParams.set('section', section)
				url.searchParams.set('ajax_call', 'y')
				const response = await fetch(url, {
					signal: own.signal,
					headers: { Accept: 'text/html' },
					credentials: 'same-origin',
				})
				if (!response.ok) throw new Error(`HTTP ${response.status}`)
				html = await response.text()
			}
			if (own.signal.aborted || signal.aborted) return
			// Разметку фильтров отдаёт наш бэк (шаблон компонента), модули смонтирует app.js
			const template = document.createElement('template')
			template.innerHTML = html
			filterList.replaceChildren(template.content)
		} catch {
			if (own.signal.aborted || signal.aborted) return
			const error = document.createElement('p')
			error.className = 'site-search__filters-error'
			error.textContent = 'Фильтры раздела не загрузились'
			filterList.replaceChildren(error)
		} finally {
			if (filtersRequest === own) {
				filtersRequest = null
				filterList.removeAttribute('aria-busy')
			}
		}
		updateSummaries()
		scheduleSuggest(0)
	}

	// ---------- Открыть / закрыть ----------

	const open = () => {
		if (isOpen()) return
		root.classList.add('is-open')
		// Шапка поднимается над таб-баром и cookie (без :has — для старых браузеров)
		root.closest('.header')?.classList.add('has-search-open')
		input.setAttribute('aria-expanded', 'true')
		chip.hidden = true
		if (isFull()) {
			release = lockBody()
			revealInRow(sectionList, currentSection()?.closest('label'))
		}
		if (query().length >= MIN_CHARS) scheduleSuggest(0)
	}

	const close = () => {
		if (!isOpen()) return
		root.classList.remove('is-open', 'is-filters-open')
		root.closest('.header')?.classList.remove('has-search-open')
		input.setAttribute('aria-expanded', 'false')
		summary.setAttribute('aria-expanded', 'false')
		release?.()
		release = null
		setActive(-1)
		updateSummaries()
	}

	input.addEventListener('focus', open, { signal })
	input.addEventListener('click', open, { signal })
	input.addEventListener(
		'input',
		() => {
			clear.hidden = !input.value
			if (!isOpen()) open()
			updateApply()
			scheduleSuggest()
		},
		{ signal }
	)
	clear.addEventListener(
		'click',
		() => {
			input.value = ''
			clear.hidden = true
			showResults(false)
			updateApply()
			input.focus()
		},
		{ signal }
	)
	chip.addEventListener('click', resetFilters, { signal })
	root.querySelector('[data-site-search-close]')?.addEventListener(
		'click',
		() => {
			close()
			input.blur()
		},
		{ signal }
	)
	root.querySelectorAll('[data-site-search-reset]').forEach((button) =>
		button.addEventListener('click', resetFilters, { signal })
	)
	summary.addEventListener(
		'click',
		() => {
			const expanded = root.classList.toggle('is-filters-open')
			summary.setAttribute('aria-expanded', String(expanded))
		},
		{ signal }
	)

	// Раздел
	form.addEventListener(
		'change',
		(event) => {
			const target = event.target
			if (target.name === 'section') {
				revealInRow(sectionList, target.closest('label'))
				loadFilters(target.value)
				return
			}
			if (!filterList.contains(target)) return
			updateSummaries()
			// Список с мультивыбором — на каждый пункт (подсказки пересчитываются сразу)
			scheduleSuggest(DELAY)
		},
		{ signal }
	)

	// Клавиатура: ↑↓ — подсказки, Enter — выбранная, Esc — закрыть
	input.addEventListener(
		'keydown',
		(event) => {
			const options = list.querySelectorAll('[role="option"]')
			if (event.key === 'ArrowDown' && options.length) {
				event.preventDefault()
				setActive((active + 1) % options.length)
			} else if (event.key === 'ArrowUp' && options.length) {
				event.preventDefault()
				setActive(active <= 0 ? options.length - 1 : active - 1)
			} else if (event.key === 'Enter' && active >= 0) {
				event.preventDefault()
				const link = options[active]?.querySelector('a')
				if (link) window.location.assign(link.href)
			}
		},
		{ signal }
	)
	root.addEventListener(
		'keydown',
		(event) => {
			if (event.key !== 'Escape' || !isOpen() || event.defaultPrevented) return
			event.preventDefault()
			close()
			if (isFull()) input.blur()
		},
		{ signal }
	)

	// Клик вне поиска (на десктопе) — закрыть. Окна списков и календаря — внутри блока
	document.addEventListener(
		'pointerdown',
		(event) => {
			if (isOpen() && !isFull() && !root.contains(event.target)) close()
		},
		{ signal }
	)
	root.addEventListener(
		'focusout',
		(event) => {
			if (isOpen() && !isFull() && event.relatedTarget && !root.contains(event.relatedTarget))
				close()
		},
		{ signal }
	)

	// Отправка: пустые параметры в адрес не попадают. У раздела может быть своя страница
	// результатов (data-action — разделы ЛК ведут в свои списки), иначе — общая action формы.
	// Раздел ведёт на эту же страницу — поиск сначала предлагает фильтры ей (событие
	// site-search:apply с адресом и параметрами): страница, которая применяет их сама (список
	// ЛК), отменяет событие — окно закрывается без перехода. Никто не отменил — переход
	form.addEventListener(
		'submit',
		(event) => {
			event.preventDefault()
			const url = new URL(
				currentSection()?.dataset.action || form.getAttribute('action') || window.location.pathname,
				window.location.href
			)
			url.search = params().toString()
			if (url.origin === window.location.origin && url.pathname === window.location.pathname) {
				const handled = !root.dispatchEvent(
					new CustomEvent('site-search:apply', {
						bubbles: true,
						cancelable: true,
						detail: { url, params: new URLSearchParams(url.search) },
					})
				)
				if (handled) {
					close()
					input.blur()
					return
				}
			}
			release?.()
			release = null
			window.location.assign(url)
		},
		{ signal }
	)

	media.addEventListener(
		'change',
		() => {
			if (!isOpen()) return
			// Сменили ширину с открытым окном: блокировка — только в полноэкранном режиме
			if (isFull() && !release) release = lockBody()
			if (!isFull() && release) {
				release()
				release = null
			}
		},
		{ signal }
	)

	clear.hidden = !input.value
	updateSummaries()

	return () => {
		controller.abort()
		clearTimeout(suggestTimer)
		suggestRequest?.abort()
		filtersRequest?.abort()
		release?.()
		root.classList.remove('is-open', 'is-filters-open', 'has-query', 'has-filters')
		root.closest('.header')?.classList.remove('has-search-open')
	}
}
