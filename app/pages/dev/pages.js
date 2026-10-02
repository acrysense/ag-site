import './pages.scss'

// Страница «Страницы вёрстки»: карточки по разделам из dev-pages.json, копирование ссылок
// (по одной и всем списком «Название — адрес»). Адреса — полные, чтобы их можно было отправить.
const meta = document.querySelector('meta[name="dev-pages"]')
const list = document.querySelector('[data-pages-list]')
const copyAll = document.querySelector('[data-pages-copy-all]')
const showcase = document.querySelector('[data-pages-showcase]')

const make = (tag, className, text) => {
	const el = document.createElement(tag)
	if (className) el.className = className
	if (text) el.textContent = text
	return el
}
const absolute = (url) => new URL(url, window.location.href).href

const copy = async (button, text, done) => {
	const label = button.textContent
	try {
		await navigator.clipboard.writeText(text)
		button.textContent = done
	} catch {
		button.textContent = 'Не удалось скопировать'
	}
	setTimeout(() => (button.textContent = label), 1600)
}

// Значок «копировать» (служебная страница: свой SVG, спрайт сайта здесь не подключается)
const COPY_ICON =
	'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>'
const DONE_ICON =
	'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'

// Мини-кнопка: на мгновение галочка и подпись «Скопировано» для скринридера
const copyIcon = async (button, text, label) => {
	try {
		await navigator.clipboard.writeText(text)
		button.innerHTML = DONE_ICON
		button.classList.add('is-done')
		button.setAttribute('aria-label', 'Скопировано')
	} catch {
		button.setAttribute('aria-label', 'Не удалось скопировать')
	}
	setTimeout(() => {
		button.innerHTML = COPY_ICON
		button.classList.remove('is-done')
		button.setAttribute('aria-label', label)
	}, 1400)
}

async function init() {
	if (!meta || !list) return
	const response = await fetch(meta.content, { cache: 'no-cache' })
	const index = await response.json()
	// В демо витрины нет — ссылки на неё тоже
	if (showcase && index.showcaseUrl) showcase.href = index.showcaseUrl
	else showcase?.remove()

	const groups = new Map()
	for (const page of index.pages) {
		if (!groups.has(page.group)) groups.set(page.group, [])
		groups.get(page.group).push(page)
	}

	for (const [name, pages] of groups) {
		const section = make('section', 'pages-index__group')
		section.append(make('h2', 'pages-index__group-title', name))
		const grid = make('ul', 'pages-index__grid')
		grid.setAttribute('role', 'list')
		for (const page of pages) {
			// Вся карточка — ссылка в новой вкладке; копирование — мини-кнопка в углу поверх неё
			const item = make('li', 'pages-index__card')
			const link = make('a', 'pages-index__title', page.title)
			link.href = page.url
			link.title = page.title
			link.target = '_blank'
			link.rel = 'noopener noreferrer'
			link.append(make('span', 'pages-index__hidden', ' (откроется в новой вкладке)'))
			const path = make('span', 'pages-index__path', `${page.name}.html`)
			const button = make('button', 'pages-index__copy')
			button.type = 'button'
			button.innerHTML = COPY_ICON
			const label = `Скопировать ссылку: ${page.title}`
			button.setAttribute('aria-label', label)
			button.title = 'Скопировать ссылку'
			button.addEventListener('click', () => copyIcon(button, absolute(page.url), label))
			item.append(link, path)
			if (page.note) item.append(make('p', 'pages-index__note', page.note))
			item.append(button)
			grid.append(item)
		}
		section.append(grid)
		list.append(section)
	}

	copyAll?.addEventListener('click', () => {
		const text = index.pages.map((page) => `${page.title} — ${absolute(page.url)}`).join('\n')
		copy(copyAll, text, 'Ссылки скопированы')
	})
}

init()
