import './ui.scss'

const nav = document.querySelector('[data-ui-nav]')
const empty = document.querySelector('[data-ui-empty]')
const search = document.querySelector('[data-ui-search]')
const crumb = document.querySelector('[data-ui-group]')
const title = document.querySelector('[data-ui-title]')
const backend = document.querySelector('[data-ui-backend]')
const states = document.querySelector('[data-ui-states]')
const widths = document.querySelector('[data-ui-widths]')
const openLink = document.querySelector('[data-ui-open]')
const stage = document.querySelector('[data-ui-stage]')
const screen = document.querySelector('[data-ui-screen]')
const scaleNote = document.querySelector('[data-ui-scale]')
const firstFrame = document.querySelector('[data-ui-frame]')

// Два iframe: новое состояние грузится в скрытый и показывается, когда собралось (стили, шрифты,
// скрипты блоков), — без мигания недособранной страницы. Пока ждём дольше LOADING_DELAY —
// полоска загрузки над превью.
const LOADING_DELAY = 200
const SETTLE_QUIET = 120
const SETTLE_MAX = 1500
const frames = [firstFrame, firstFrame.cloneNode()]
let front = frames[0]
let wanted = ''
let loadingTimer = 0

const hideFrame = (frame) => {
	frame.classList.add('is-back')
	frame.setAttribute('aria-hidden', 'true')
	frame.tabIndex = -1
}
hideFrame(frames[1])
frames[1].removeAttribute('data-ui-frame')

// dev: /dev/ui.html → /dev/canvas.html; сборка: /BASE/dev-ui.html → /BASE/dev-canvas.html
const canvasUrl = window.location.pathname.replace(/ui\.html$/, 'canvas.html')

// Ширины макета: мобильный, планшет, десктоп
const WIDTHS = ['360', '768', '1440']

let stories = []
// Холст ещё не загрузился — заголовок «Загрузка…», а не «историй нет»
let loaded = false

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
		backend: node.dataset.backend || '',
		widths: node.dataset.widths?.split(/\s+/) || null,
		states: [...node.querySelectorAll('[data-state-label]')].map((state, index) => ({
			index: String(index),
			label: state.dataset.stateLabel,
			note: state.dataset.stateNote || '',
			widths: state.dataset.widths?.split(/\s+/) || null,
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

// Пути к файлам — ссылки на репозиторий: папка компонента (шаблон, стили, скрипт) и контракт.
// Репозиторий публичный (адрес — data-repo у body), ссылка работает и в демо, и локально
const REPO = document.body.dataset.repo
const PATH = /((?:app|docs)\/[\w./-]+)/
const withPaths = (text) =>
	text
		.split(PATH)
		.filter(Boolean)
		.map((part) => {
			if (!PATH.test(part)) return part
			const link = el('a', 'ui__path', part)
			link.href = `${REPO}/${part.endsWith('/') ? 'tree' : 'blob'}/main/${part}`
			link.target = '_blank'
			link.rel = 'noopener noreferrer'
			return link
		})

function renderInfo(story, active) {
	crumb.textContent = story?.group || ''
	title.textContent = story?.title || (loaded ? 'Историй пока нет' : 'Загрузка…')

	// Одна строка для бэка: папка шаблона · контракт — главное правило. Не влезла — многоточие,
	// целиком во всплывающей подсказке. Место под строку есть всегда — панель не меняет высоту
	backend.replaceChildren(
		...(story?.backend ? [el('b', '', 'Бэку:'), ' ', ...withPaths(story.backend)] : [])
	)
	backend.title = story?.backend || ''

	// Вкладки состояний — только когда есть из чего выбирать; место под них остаётся
	const items = story ? shown(story) : []
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

// Ширины, на которых блок есть (нижняя панель — только на телефоне). Выбранной нет — ближайшая
// из доступных; сам выбор в адресе остаётся для других историй
let shownWidth = currentWidth()
const allowedWidths = (story, state) => state?.widths || story?.widths || WIDTHS
function pickWidth(allowed) {
	const wanted = currentWidth()
	if (allowed.includes(wanted)) return wanted
	return [...allowed].sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted))[0]
}

// Широкий макет не влезает в окно — уменьшаем iframe целиком, медиазапросы остаются от ширины
function fitFrame() {
	const width = Number(shownWidth)
	const styles = getComputedStyle(stage)
	const room =
		stage.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight)
	const height =
		stage.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom)
	const scale = Math.min(1, room / width)

	screen.style.width = `${Math.floor(width * scale)}px`
	for (const frame of frames) {
		frame.style.width = `${width}px`
		frame.style.height = `${height / scale}px`
		frame.style.transform = scale < 1 ? `scale(${scale})` : ''
	}
	scaleNote.hidden = scale >= 1
	scaleNote.textContent = `масштаб ${Math.round(scale * 100)} %`
}

function apply() {
	const { story, state } = current()
	const hash = readHash()
	// До первой загрузки canvas меню ещё пустое — берём историю прямо из адреса
	// Пустая история — холст сам покажет первую, а не все разом
	const id = story?.id ?? hash.story ?? ''
	const stateIndex = story ? state?.index : hash.state
	const query = new URLSearchParams({ story: id })
	if (id && stateIndex !== undefined && stateIndex !== null) query.set('state', stateIndex)
	const src = `${canvasUrl}${query.size ? `?${query}` : ''}`

	if (wanted !== src) load(src)

	openLink.href = src
	for (const link of nav.querySelectorAll('[data-story-link]')) {
		if (link.dataset.storyLink === story?.id) link.setAttribute('aria-current', 'page')
		else link.removeAttribute('aria-current')
	}
	const allowed = allowedWidths(story, state)
	shownWidth = pickWidth(allowed)
	for (const button of widths.querySelectorAll('[data-ui-width]')) {
		const width = button.dataset.uiWidth
		button.setAttribute('aria-pressed', String(width === shownWidth))
		button.disabled = !allowed.includes(width)
		button.title = button.disabled ? 'На этой ширине блока нет' : ''
	}
	renderInfo(story, state)
	fitFrame()
}

function load(src) {
	wanted = src
	// Всегда в скрытый кадр, и в первый раз тоже: недособранная страница на экран не попадает
	const frame = frames.find((item) => item !== front)
	frame.dataset.src = src
	frame.src = src
	clearTimeout(loadingTimer)
	loadingTimer = setTimeout(() => screen.classList.add('is-loading'), LOADING_DELAY)
}

// Таймер, а не requestAnimationFrame: в фоновой вкладке кадры не идут и показ бы завис
const tick = () => new Promise((resolve) => setTimeout(resolve, 30))

// Собралось: шрифты загружены и разметка перестала меняться (скрипты блоков подгружаются
// после load и дорисовывают своё)
async function settle(doc) {
	const start = performance.now()
	await Promise.race([
		doc.fonts?.ready,
		new Promise((resolve) => setTimeout(resolve, SETTLE_MAX)),
	])
	const nodes = doc.getElementsByTagName('*')
	let last = ''
	let quietSince = performance.now()
	while (performance.now() - start < SETTLE_MAX) {
		await tick()
		const now = performance.now()
		const signature = `${nodes.length}:${doc.documentElement.scrollHeight}`
		if (signature !== last) {
			last = signature
			quietSince = now
		} else if (now - quietSince >= SETTLE_QUIET) return
	}
}

function show(frame) {
	clearTimeout(loadingTimer)
	screen.classList.remove('is-loading')
	if (frame === front) return
	const old = front
	frame.classList.remove('is-back')
	frame.removeAttribute('aria-hidden')
	frame.removeAttribute('tabindex')
	front = frame
	// Прошлое состояние не нужно — выгружаем, чтобы его скрипты не работали впустую
	hideFrame(old)
	old.dataset.src = ''
	old.src = 'about:blank'
}

// Меню пересобирается на каждой загрузке canvas: новые истории видны после HMR
for (const frame of frames) {
	frame.addEventListener('load', async () => {
		const doc = frame.contentDocument
		if (!doc || !frame.dataset.src || frame.dataset.src !== wanted) return
		if (frame !== front) {
			await settle(doc)
			// Пока ждали, во фрейм уже загрузили другое состояние — покажет его своя загрузка
			if (frame.dataset.src !== wanted || frame.contentDocument !== doc) return
		}
		show(frame)
		loaded = true
		stories = readStories(doc)
		buildNav()
		apply()
	})
}
screen.append(frames[1])

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

new ResizeObserver(fitFrame).observe(stage)
window.addEventListener('hashchange', apply)

apply()
