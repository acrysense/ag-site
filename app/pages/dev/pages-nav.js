import SimpleBar from 'simplebar'
import './pages-nav.scss'

// Кнопка «Страницы» на страницах демо и dev (подключает layouts/Head при demo): список страниц
// вёрстки по разделам, текущая отмечена, «Скопировать ссылку», переход ко всем страницам и витрине.
// Длинный список прокручивается внутри панели — SimpleBar, как списки сайта (стили — сайта).
// Страниц больше SEARCH_FROM — сверху поле «Найти страницу»: фильтр по названию и имени файла,
// Enter открывает первую найденную.
// Список — dev-pages.json (плагин pagesIndexPlugin в vite.config.ts). Не показывается в iframe
// витрины, на служебных страницах (dev/*) и с ?nav=0 (для чистых скриншотов).
const meta = document.querySelector('meta[name="dev-pages"]')
const params = new URLSearchParams(window.location.search)
const SEARCH_FROM = 15
const isDevPage = /(^|\/)dev[-/]/.test(window.location.pathname)

if (meta && window.top === window && params.get('nav') !== '0' && !isDevPage) mount(meta.content)

async function mount(indexUrl) {
	let index
	try {
		const response = await fetch(indexUrl, { cache: 'no-cache' })
		if (!response.ok) return
		index = await response.json()
	} catch {
		return
	}
	const here = new URL(window.location.href)
	const isCurrent = (url) => new URL(url, here).pathname === here.pathname
	const make = (tag, className, text) => {
		const el = document.createElement(tag)
		if (className) el.className = className
		if (text) el.textContent = text
		return el
	}

	const root = make('div', 'pages-nav')
	const toggle = make('button', 'pages-nav__toggle', 'Страницы')
	toggle.type = 'button'
	toggle.setAttribute('aria-expanded', 'false')
	toggle.setAttribute('aria-controls', 'pages-nav-panel')

	const panel = make('div', 'pages-nav__panel')
	panel.id = 'pages-nav-panel'
	panel.hidden = true
	panel.setAttribute('role', 'dialog')
	panel.setAttribute('aria-label', 'Страницы вёрстки')

	const head = make('div', 'pages-nav__head')
	head.append(make('span', 'pages-nav__title', 'Страницы вёрстки'))
	const all = make('a', 'pages-nav__all', 'Все страницы')
	all.href = index.pagesUrl
	head.append(all)
	panel.append(head)

	const search = index.pages.length > SEARCH_FROM ? make('input', 'pages-nav__search') : null
	if (search) {
		search.type = 'search'
		search.placeholder = 'Найти страницу'
		search.setAttribute('aria-label', 'Найти страницу')
		search.autocomplete = 'off'
		panel.append(search)
	}

	const list = make('nav', 'pages-nav__list')
	list.setAttribute('aria-label', 'Страницы')
	const empty = make('p', 'pages-nav__empty', 'Ничего не найдено')
	empty.hidden = true
	const entries = []
	let group = null
	let heading = null
	for (const page of index.pages) {
		if (page.group !== group) {
			group = page.group
			heading = make('p', 'pages-nav__group', group)
			list.append(heading)
		}
		const link = make('a', 'pages-nav__link', page.title)
		link.href = page.url
		if (isCurrent(page.url)) link.setAttribute('aria-current', 'page')
		list.append(link)
		entries.push({ link, heading, text: `${page.title} ${page.name}`.toLowerCase() })
	}
	list.append(empty)
	panel.append(list)

	const foot = make('div', 'pages-nav__foot')
	const copy = make('button', 'pages-nav__action', 'Скопировать ссылку')
	copy.type = 'button'
	foot.append(copy)
	// В демо витрины нет — ссылки на неё тоже
	if (index.showcaseUrl) {
		const showcase = make('a', 'pages-nav__action', 'Витрина')
		showcase.href = index.showcaseUrl
		foot.append(showcase)
	}
	panel.append(foot)

	root.append(panel, toggle)
	document.body.append(root)

	let copyTimer = 0
	let simplebar = null
	const setOpen = (open) => {
		panel.hidden = !open
		toggle.setAttribute('aria-expanded', String(open))
		if (!open) return
		// Полоса прокрутки — когда панель видна (SimpleBar меряет содержимое); текущая — в видимой части
		simplebar ||= new SimpleBar(list, { autoHide: false })
		simplebar.recalculate()
		const current = list.querySelector('[aria-current]')
		const scroller = simplebar.getScrollElement()
		if (current && scroller) {
			const top = current.offsetTop - scroller.clientHeight / 2 + current.offsetHeight / 2
			scroller.scrollTop = Math.max(0, top)
		}
	}
	toggle.addEventListener('click', () => {
		setOpen(panel.hidden)
		// Фокус в поле — только с мышью: на телефоне он сразу открыл бы клавиатуру
		if (!panel.hidden && window.matchMedia('(hover: hover)').matches) search?.focus()
	})

	const filter = () => {
		const query = search.value.trim().toLowerCase()
		const shown = new Set()
		for (const entry of entries) {
			entry.link.hidden = Boolean(query) && !entry.text.includes(query)
			if (!entry.link.hidden) shown.add(entry.heading)
		}
		for (const entry of entries) entry.heading.hidden = !shown.has(entry.heading)
		empty.hidden = shown.size > 0
		simplebar?.recalculate()
		simplebar?.getScrollElement()?.scrollTo(0, 0)
	}
	search?.addEventListener('input', filter)
	search?.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter') return
		const first = entries.find((entry) => !entry.link.hidden)
		if (first) window.location.assign(first.link.href)
	})
	copy.addEventListener('click', async () => {
		const url = new URL(window.location.href)
		url.searchParams.delete('nav')
		try {
			await navigator.clipboard.writeText(url.href)
			copy.textContent = 'Ссылка скопирована'
		} catch {
			copy.textContent = 'Не удалось скопировать'
		}
		clearTimeout(copyTimer)
		copyTimer = setTimeout(() => (copy.textContent = 'Скопировать ссылку'), 1600)
	})
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && !panel.hidden) {
			setOpen(false)
			toggle.focus()
		}
	})
	document.addEventListener('pointerdown', (event) => {
		if (!panel.hidden && !root.contains(event.target)) setOpen(false)
	})
}
