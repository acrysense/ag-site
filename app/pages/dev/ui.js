import './ui.scss'

const DEFAULT_WIDTH = '1440'

const nav = document.querySelector('[data-ui-nav]')
const title = document.querySelector('[data-ui-title]')
const widths = document.querySelector('[data-ui-widths]')
const scaleLabel = document.querySelector('[data-ui-scale]')
const openLink = document.querySelector('[data-ui-open]')
const stage = document.querySelector('[data-ui-stage]')
const viewport = document.querySelector('[data-ui-viewport]')
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

function buildNav(doc) {
	stories = [...doc.querySelectorAll('[data-story]')].map((el) => ({
		id: el.dataset.story,
		group: el.dataset.group || 'Прочее',
		title: el.dataset.title || el.dataset.story,
	}))

	const groups = new Map()
	for (const story of stories) {
		if (!groups.has(story.group)) groups.set(story.group, [])
		groups.get(story.group).push(story)
	}

	nav.replaceChildren(
		...[...groups].map(([group, items]) => {
			const section = document.createElement('section')
			section.className = 'ui__group'

			const heading = document.createElement('h2')
			heading.className = 'ui__group-title'
			heading.textContent = group

			const list = document.createElement('ul')
			list.className = 'ui__list'
			for (const story of items) {
				const link = document.createElement('a')
				link.className = 'ui__link'
				link.href = `#${new URLSearchParams({ ...readHash(), story: story.id })}`
				link.textContent = story.title
				link.dataset.storyLink = story.id
				const item = document.createElement('li')
				item.append(link)
				list.append(item)
			}

			section.append(heading, list)
			return section
		})
	)
}

function currentStory() {
	const { story } = readHash()
	return stories.find((item) => item.id === story) || stories[0]
}

function resize() {
	const width = Number(readHash().w ?? DEFAULT_WIDTH)
	const available = stage.clientWidth
	const target = width || available
	const scale = Math.min(1, available / target)

	// Широкий экран не помещается в окно: рисуем его в полную ширину и уменьшаем
	viewport.style.width = `${target * scale}px`
	frame.style.width = `${target}px`
	frame.style.height = `${stage.clientHeight / scale}px`
	frame.style.transform = scale < 1 ? `scale(${scale})` : ''
	scaleLabel.textContent =
		scale < 1 ? `${target}px, уменьшено до ${Math.round(scale * 100)}%` : ''

	for (const button of widths.querySelectorAll('[data-width]')) {
		button.setAttribute('aria-pressed', String(button.dataset.width === String(width)))
	}
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

	title.textContent = story?.title || 'Историй пока нет'
	openLink.href = src
	for (const link of nav.querySelectorAll('[data-story-link]')) {
		if (link.dataset.storyLink === story?.id) link.setAttribute('aria-current', 'page')
		else link.removeAttribute('aria-current')
	}
	resize()
}

// Меню пересобирается на каждой загрузке canvas: новые истории видны после HMR
frame.addEventListener('load', () => {
	if (!frame.contentDocument) return
	buildNav(frame.contentDocument)
	apply()
})

nav.addEventListener('click', (event) => {
	const link = event.target.closest('[data-story-link]')
	if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return
	event.preventDefault()
	writeHash({ story: link.dataset.storyLink })
})

widths.addEventListener('click', (event) => {
	const button = event.target.closest('[data-width]')
	if (button) writeHash({ w: button.dataset.width })
})

window.addEventListener('hashchange', apply)
new ResizeObserver(resize).observe(stage)

apply()
