import './ui.scss'

const nav = document.querySelector('[data-ui-nav]')
const empty = document.querySelector('[data-ui-empty]')
const search = document.querySelector('[data-ui-search]')
const crumb = document.querySelector('[data-ui-group]')
const title = document.querySelector('[data-ui-title]')
const description = document.querySelector('[data-ui-description]')
const states = document.querySelector('[data-ui-states]')
const boundsToggle = document.querySelector('[data-ui-bounds]')
const openLink = document.querySelector('[data-ui-open]')
const frame = document.querySelector('[data-ui-frame]')

// dev: /dev/ui.html → /dev/canvas.html; сборка: /BASE/dev-ui.html → /BASE/dev-canvas.html
const canvasUrl = window.location.pathname.replace(/ui\.html$/, 'canvas.html')

let stories = []

const readHash = () => Object.fromEntries(new URLSearchParams(window.location.hash.slice(1)))

function writeHash(patch) {
	const next = new URLSearchParams({ ...readHash(), ...patch })
	history.replaceState(null, '', `#${next}`)
	apply()
}

const el = (tag, className, text) => {
	const node = document.createElement(tag)
	if (className) node.className = className
	if (text) node.textContent = text
	return node
}

function readStories(doc) {
	return [...doc.querySelectorAll('[data-story]')].map((node) => ({
		id: node.dataset.story,
		group: node.dataset.group || 'Прочее',
		title: node.dataset.title || node.dataset.story,
		description: node.dataset.description || '',
		states: [...node.querySelectorAll('[data-state-label]')].map((state) => ({
			node: state,
			label: state.dataset.stateLabel,
			note: state.dataset.stateNote || '',
		})),
	}))
}

function buildNav() {
	const groups = new Map()
	for (const story of stories) {
		if (!groups.has(story.group)) groups.set(story.group, [])
		groups.get(story.group).push(story)
	}

	nav.replaceChildren(
		...[...groups].map(([group, items]) => {
			const section = el('section', 'ui__group')
			const heading = el('h2', 'ui__group-title', group)
			heading.append(el('span', 'ui__group-count', String(items.length)))

			const list = el('ul', 'ui__list')
			for (const story of items) {
				const link = el('a', 'ui__link', story.title)
				link.href = `#${new URLSearchParams({ ...readHash(), story: story.id })}`
				link.dataset.storyLink = story.id
				const item = el('li')
				item.append(link)
				list.append(item)
			}

			section.append(heading, list)
			return section
		})
	)
	filterNav()
}

function filterNav() {
	const query = search.value.trim().toLowerCase()
	let visible = 0
	for (const section of nav.querySelectorAll('.ui__group')) {
		let groupVisible = 0
		for (const item of section.querySelectorAll('li')) {
			const match = !query || item.textContent.toLowerCase().includes(query)
			item.hidden = !match
			if (match) groupVisible += 1
		}
		section.hidden = groupVisible === 0
		visible += groupVisible
	}
	empty.hidden = visible > 0
}

function currentStory() {
	const { story } = readHash()
	return stories.find((item) => item.id === story) || stories[0]
}

function renderInfo(story) {
	crumb.textContent = story?.group || ''
	title.textContent = story?.title || 'Историй пока нет'
	description.textContent = story?.description || ''
	description.hidden = !story?.description

	const items = story?.states || []
	states.previousElementSibling.hidden = items.length === 0
	states.replaceChildren(
		...items.map((state) => {
			const button = el('button', 'ui__state', state.label)
			button.type = 'button'
			if (state.note) {
				button.classList.add('is-muted')
				button.append(el('span', 'ui__state-note', state.note))
			}
			button.addEventListener('click', () =>
				state.node.scrollIntoView({ behavior: 'smooth', block: 'start' })
			)
			const item = el('li')
			item.append(button)
			return item
		})
	)
}

function applyBounds() {
	const on = readHash().bounds !== '0'
	boundsToggle.setAttribute('aria-pressed', String(on))
	frame.contentDocument?.documentElement.classList.toggle('show-bounds', on)
}

function apply() {
	const story = currentStory()
	// До первой загрузки canvas меню ещё пустое — берём историю прямо из адреса
	const id = story?.id ?? readHash().story
	const src = id ? `${canvasUrl}?story=${encodeURIComponent(id)}` : canvasUrl

	if (frame.dataset.src !== src) {
		frame.dataset.src = src
		frame.src = src
	}

	openLink.href = src
	for (const link of nav.querySelectorAll('[data-story-link]')) {
		if (link.dataset.storyLink === story?.id) link.setAttribute('aria-current', 'page')
		else link.removeAttribute('aria-current')
	}
	renderInfo(story)
	applyBounds()
}

// Меню пересобирается на каждой загрузке canvas: новые истории видны после HMR
frame.addEventListener('load', () => {
	if (!frame.contentDocument) return
	stories = readStories(frame.contentDocument)
	buildNav()
	apply()
})

nav.addEventListener('click', (event) => {
	const link = event.target.closest('[data-story-link]')
	if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return
	event.preventDefault()
	writeHash({ story: link.dataset.storyLink })
})

search.addEventListener('input', filterNav)

// «/» — к поиску, как в Storybook
document.addEventListener('keydown', (event) => {
	if (event.key !== '/' || event.target.closest('input, textarea, [contenteditable]')) return
	event.preventDefault()
	search.focus()
})

boundsToggle.addEventListener('click', () => {
	writeHash({ bounds: boundsToggle.getAttribute('aria-pressed') === 'true' ? '0' : '1' })
})

window.addEventListener('hashchange', apply)

apply()
