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
		states: [...node.querySelectorAll('[data-state-label]')].map((state, index) => ({
			index: String(index),
			label: state.dataset.stateLabel,
			note: state.dataset.stateNote || '',
		})),
	}))
}

// Состояния, которые можно показать (у неприменимых только пояснение)
const shown = (story) => story.states.filter((state) => !state.note)

const storyHash = (story, state) =>
	`#${new URLSearchParams({ ...readHash(), story: story.id, ...(state ? { state: state.index } : {}) })}`

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
				const states = shown(story)
				const link = el('a', 'ui__link', story.title)
				link.href = storyHash(story, states[0])
				link.dataset.storyLink = story.id
				if (states[0]) link.dataset.stateLink = states[0].index
				if (states.length > 1)
					link.append(el('span', 'ui__link-count', String(states.length)))

				const item = el('li')
				item.dataset.storyItem = story.id
				item.append(link)

				// Состояния компонента — вложенным списком, раскрыт у выбранного
				if (states.length > 1) {
					const sub = el('ul', 'ui__sublist')
					for (const state of states) {
						const subLink = el('a', 'ui__sublink', state.label)
						subLink.href = storyHash(story, state)
						subLink.dataset.storyLink = story.id
						subLink.dataset.stateLink = state.index
						const subItem = el('li')
						subItem.append(subLink)
						sub.append(subItem)
					}
					item.append(sub)
				}
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
		for (const item of section.querySelectorAll('[data-story-item]')) {
			const match = !query || item.textContent.toLowerCase().includes(query)
			item.hidden = !match
			if (match) groupVisible += 1
		}
		section.hidden = groupVisible === 0
		visible += groupVisible
	}
	empty.hidden = visible > 0
}

function current() {
	const hash = readHash()
	const story = stories.find((item) => item.id === hash.story) || stories[0]
	if (!story) return { story: null, state: null }
	const states = shown(story)
	const state = states.find((item) => item.index === hash.state) || states[0] || null
	return { story, state }
}

function renderInfo(story, active) {
	crumb.textContent = story ? [story.group, active?.label].filter(Boolean).join(' · ') : ''
	title.textContent = story?.title || 'Историй пока нет'
	description.textContent = story?.description || ''
	description.hidden = !story?.description

	const items = story?.states || []
	states.previousElementSibling.hidden = items.length === 0
	states.replaceChildren(
		...items.map((state) => {
			const item = el('li')
			if (state.note) {
				const muted = el('span', 'ui__state is-muted', state.label)
				muted.append(el('span', 'ui__state-note', state.note))
				item.append(muted)
				return item
			}
			const link = el('a', 'ui__state', state.label)
			link.href = storyHash(story, state)
			link.dataset.storyLink = story.id
			link.dataset.stateLink = state.index
			if (state.index === active?.index) link.setAttribute('aria-current', 'true')
			item.append(link)
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
	const { story, state } = current()
	const hash = readHash()
	// До первой загрузки canvas меню ещё пустое — берём историю прямо из адреса
	const id = story?.id ?? hash.story
	const stateIndex = story ? state?.index : hash.state
	const query = new URLSearchParams(id ? { story: id } : {})
	if (id && stateIndex !== undefined && stateIndex !== null) query.set('state', stateIndex)
	const src = `${canvasUrl}${query.size ? `?${query}` : ''}`

	if (frame.dataset.src !== src) {
		frame.dataset.src = src
		frame.src = src
	}

	openLink.href = src
	for (const item of nav.querySelectorAll('[data-story-item]')) {
		item.classList.toggle('is-open', item.dataset.storyItem === story?.id)
	}
	for (const link of nav.querySelectorAll('[data-story-link]')) {
		const isStory = link.dataset.storyLink === story?.id
		const isState = link.classList.contains('ui__sublink')
		const active = isStory && (!isState || link.dataset.stateLink === state?.index)
		if (active) link.setAttribute('aria-current', 'page')
		else link.removeAttribute('aria-current')
	}
	renderInfo(story, state)
	applyBounds()
}

// Меню пересобирается на каждой загрузке canvas: новые истории видны после HMR
frame.addEventListener('load', () => {
	if (!frame.contentDocument) return
	stories = readStories(frame.contentDocument)
	buildNav()
	apply()
})

// Ссылки на историю и состояние — в меню и в списке состояний справа
const onStoryClick = (event) => {
	const link = event.target.closest('[data-story-link]')
	if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return
	event.preventDefault()
	const patch = { story: link.dataset.storyLink }
	if (link.dataset.stateLink) patch.state = link.dataset.stateLink
	const next = new URLSearchParams({ ...readHash(), ...patch })
	if (!link.dataset.stateLink) next.delete('state')
	history.replaceState(null, '', `#${next}`)
	apply()
}
nav.addEventListener('click', onStoryClick)
states.addEventListener('click', onStoryClick)

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
