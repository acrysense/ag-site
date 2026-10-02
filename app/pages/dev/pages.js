import './pages.scss'

// Страница «Страницы вёрстки»: карточки по разделам из dev-pages.json, поиск, копирование ссылок
// (по одной и всем списком «Название — адрес»). Адреса — полные, чтобы их можно было отправить.
const meta = document.querySelector('meta[name="dev-pages"]')
const list = document.querySelector('[data-pages-list]')
const empty = document.querySelector('[data-pages-empty]')
const search = document.querySelector('[data-pages-search]')
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

	const cards = []
	for (const [name, pages] of groups) {
		const section = make('section', 'pages-index__group')
		section.append(make('h2', 'pages-index__group-title', name))
		const grid = make('ul', 'pages-index__grid')
		grid.setAttribute('role', 'list')
		for (const page of pages) {
			const item = make('li', 'pages-index__card')
			const link = make('a', 'pages-index__title', page.title)
			link.href = page.url
			const path = make('span', 'pages-index__path', `${page.name}.html`)
			const row = make('div', 'pages-index__row')
			const open = make('a', 'pages-index__link', 'Открыть')
			open.href = page.url
			const button = make('button', 'pages-index__link', 'Скопировать ссылку')
			button.type = 'button'
			button.addEventListener('click', () => copy(button, absolute(page.url), 'Скопировано'))
			row.append(open, button)
			item.append(link, path)
			if (page.note) item.append(make('p', 'pages-index__note', page.note))
			item.append(row)
			grid.append(item)
			cards.push({ item, section, text: `${page.title} ${page.name} ${name}`.toLowerCase() })
		}
		section.append(grid)
		list.append(section)
	}

	search?.addEventListener('input', () => {
		const query = search.value.trim().toLowerCase()
		let shown = 0
		for (const card of cards) {
			card.item.hidden = Boolean(query) && !card.text.includes(query)
			if (!card.item.hidden) shown += 1
		}
		for (const section of list.children) {
			section.hidden = !section.querySelector('.pages-index__card:not([hidden])')
		}
		if (empty) empty.hidden = shown > 0
	})

	copyAll?.addEventListener('click', () => {
		const text = index.pages.map((page) => `${page.title} — ${absolute(page.url)}`).join('\n')
		copy(copyAll, text, 'Ссылки скопированы')
	})
}

init()
