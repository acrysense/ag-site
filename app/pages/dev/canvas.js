import './canvas.scss'

// ?story=<id> — показываем одну историю (так её открывает оболочка ui.html)
const story = new URLSearchParams(window.location.search).get('story')

if (story) {
	document.documentElement.classList.add('is-single-story')
	for (const el of document.querySelectorAll('[data-story]')) {
		el.hidden = el.dataset.story !== story
	}
}

// Имена токенов приходят из canvas.scss (--token-colors, --token-text)
const tokenNames = (prop) =>
	getComputedStyle(document.documentElement)
		.getPropertyValue(prop)
		.trim()
		.replace(/^["']|["']$/g, '')
		.split(/\s+/)
		.filter(Boolean)

const el = (tag, className, text) => {
	const node = document.createElement(tag)
	node.className = className
	if (text) node.textContent = text
	return node
}

const EMPTY_TEXT = 'Пока пусто: значения появятся из макета.'
const SPECIMEN_TEXT = 'Съешь же ещё этих мягких французских булок, да выпей чаю'

function renderColors(list) {
	const names = tokenNames('--token-colors')
	if (!names.length) return list.replaceChildren(el('p', 'tokens__empty', EMPTY_TEXT))

	list.replaceChildren(
		...names.map((name) => {
			const item = el('figure', `token-swatch token-swatch--${name}`)
			item.append(
				el('div', 'token-swatch__chip'),
				el('figcaption', 'token-swatch__name', name)
			)
			list.append(item)
			item.append(
				el(
					'p',
					'token-swatch__value',
					getComputedStyle(item).getPropertyValue('--swatch').trim()
				)
			)
			return item
		})
	)
}

let specimens = []

function renderText(list) {
	const names = tokenNames('--token-text')
	specimens = []
	if (!names.length) return list.replaceChildren(el('p', 'tokens__empty', EMPTY_TEXT))

	const items = names.map((name) => {
		const item = el('div', 'token-specimen')
		const sample = el('p', `token-specimen--${name}`, SPECIMEN_TEXT)
		const meta = el('p', 'token-specimen__meta')
		item.append(sample, meta)
		specimens.push({ sample, meta, name })
		return item
	})
	list.replaceChildren(...items)
	updateSpecimens()
}

// Размеры зависят от ширины окна — подпись обновляется при смене ширины в витрине
function updateSpecimens() {
	for (const { sample, meta, name } of specimens) {
		const style = getComputedStyle(sample)
		const size = Math.round(parseFloat(style.fontSize) * 10) / 10
		meta.textContent = `${name} · ${size}px / ${style.lineHeight} · ${style.fontWeight}`
	}
}

function renderTokens() {
	for (const list of document.querySelectorAll('[data-token-list]')) {
		if (list.dataset.tokenList === 'colors') renderColors(list)
		if (list.dataset.tokenList === 'text') renderText(list)
	}
}

renderTokens()
window.addEventListener('resize', updateSpecimens)

// Правка _vars.scss в dev обновляет только CSS — перерисовываем списки токенов
if (import.meta.hot) import.meta.hot.on('vite:afterUpdate', renderTokens)
