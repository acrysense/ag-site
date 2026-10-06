import './ui.scss'

const nav = document.querySelector('[data-ui-nav]')
const empty = document.querySelector('[data-ui-empty]')
const search = document.querySelector('[data-ui-search]')
const crumb = document.querySelector('[data-ui-group]')
const title = document.querySelector('[data-ui-title]')
const description = document.querySelector('[data-ui-description]')
const states = document.querySelector('[data-ui-states]')
const widths = document.querySelector('[data-ui-widths]')
const boundsToggle = document.querySelector('[data-ui-bounds]')
const openLink = document.querySelector('[data-ui-open]')
const stage = document.querySelector('[data-ui-stage]')
const screen = document.querySelector('[data-ui-screen]')
const scaleNote = document.querySelector('[data-ui-scale]')
const frame = document.querySelector('[data-ui-frame]')

// dev: /dev/ui.html → /dev/canvas.html; сборка: /BASE/dev-ui.html → /BASE/dev-canvas.html
const canvasUrl = window.location.pathname.replace(/ui\.html$/, 'canvas.html')

// Ширины макета: мобильный, планшет, десктоп
const WIDTHS = ['360', '768', '1440']

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
			const list = el('ul', 'ui__list')
			for (const story of items) {
				const link = el('a', 'ui__link', story.title)
				link.href = storyHash(story)
				link.dataset.storyLink = story.id
				const item = el('li')
				item.dataset.storyItem = story.id
				item.append(link)
				list.append(item)
			}
			section.append(el('h2', 'ui__group-title', group), list)
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
	crumb.textContent = story?.group || ''
	title.textContent = story?.title || 'Историй пока нет'

	// Описание и неприменимые состояния — мелким текстом под заголовком
	const skipped = story?.states.filter((state) => state.note) || []
	description.replaceChildren(
		...(story?.description ? [el('p', '', story.description)] : []),
		...skipped.map((state) => {
			const note = el('p', 'ui__note')
			note.append(el('strong', '', `${state.label}:`), ` ${state.note}`)
			return note
		})
	)
	description.hidden = !description.childElementCount

	// Вкладки состояний — только когда есть из чего выбирать
	const items = story ? shown(story) : []
	states.hidden = items.length < 2
	states.replaceChildren(
		...(items.length < 2 ? [] : items).map((state) => {
			const link = el('a', 'ui__state', state.label)
			link.href = storyHash(story, state)
			link.dataset.storyLink = story.id
			link.dataset.stateLink = state.index
			if (state.index === active?.index) link.setAttribute('aria-current', 'page')
			return link
		})
	)
	states.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

const currentWidth = () => (WIDTHS.includes(readHash().width) ? readHash().width : WIDTHS[0])

// Широкий макет не влезает в окно — уменьшаем iframe целиком, медиазапросы остаются от ширины
function fitFrame() {
	const width = Number(currentWidth())
	const styles = getComputedStyle(stage)
	const room = stage.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)
	const height = stage.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom)
	const scale = Math.min(1, room / width)

	screen.style.width = `${Math.floor(width * scale)}px`
	frame.style.width = `${width}px`
	frame.style.height = `${height / scale}px`
	frame.style.transform = scale < 1 ? `scale(${scale})` : ''
	scaleNote.hidden = scale >= 1
	scaleNote.textContent = `масштаб ${Math.round(scale * 100)} %`
}

function applyBounds() {
	const on = readHash().bounds === '1'
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
	for (const link of nav.querySelectorAll('[data-story-link]')) {
		if (link.dataset.storyLink === story?.id) link.setAttribute('aria-current', 'page')
		else link.removeAttribute('aria-current')
	}
	for (const button of widths.querySelectorAll('[data-ui-width]')) {
		button.setAttribute('aria-pressed', String(button.dataset.uiWidth === currentWidth()))
	}
	renderInfo(story, state)
	fitFrame()
	applyBounds()
}

// Меню пересобирается на каждой загрузке canvas: новые истории видны после HMR
frame.addEventListener('load', () => {
	if (!frame.contentDocument) return
	stories = readStories(frame.contentDocument)
	buildNav()
	apply()
})

// Ссылки на историю (меню) и на состояние (вкладки)
const onStoryClick = (event) => {
	const link = event.target.closest('[data-story-link]')
	if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return
	event.preventDefault()
	const next = new URLSearchParams({ ...readHash(), story: link.dataset.storyLink })
	if (link.dataset.stateLink) next.set('state', link.dataset.stateLink)
	else next.delete('state')
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

widths.addEventListener('click', (event) => {
	const button = event.target.closest('[data-ui-width]')
	if (button) writeHash({ width: button.dataset.uiWidth })
})

boundsToggle.addEventListener('click', () => {
	writeHash({ bounds: boundsToggle.getAttribute('aria-pressed') === 'true' ? '0' : '1' })
})

new ResizeObserver(fitFrame).observe(stage)
window.addEventListener('hashchange', apply)

apply()
