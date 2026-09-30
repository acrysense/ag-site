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

const EMPTY_TEXT = 'Пока пусто — значения появятся из макета.'
const SPECIMEN_TEXT = 'Съешь же ещё этих мягких французских булок, да выпей чаю'

// Относительная яркость и контраст по WCAG 2.x
function luminance(rgb) {
	const [r, g, b] = rgb.map((v) => {
		const c = v / 255
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
	})
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
	return (hi + 0.05) / (lo + 0.05)
}

const parseRgb = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number)

function contrastBadge(label, ratio) {
	const verdict = ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA крупный' : 'мало'
	const badge = el('span', `token-badge ${ratio >= 3 ? 'is-pass' : 'is-fail'}`)
	badge.textContent = `${label} ${ratio.toFixed(1)} · ${verdict}`
	badge.title = `Контраст текста этого цвета ${label === 'бел' ? 'на белом' : 'на чёрном'}`
	return badge
}

function renderColors(list) {
	const names = tokenNames('--token-colors')
	if (!names.length) return list.replaceChildren(el('p', 'tokens__empty', EMPTY_TEXT))

	list.replaceChildren(
		...names.map((name) => {
			const item = el('figure', `token-swatch token-swatch--${name}`)
			const chip = el('div', 'token-swatch__chip')
			const body = el('figcaption', 'token-swatch__body')
			item.append(chip, body)
			// Значение и контраст считаются по реальному цвету, поэтому узел нужен в DOM
			list.append(item)

			const value = getComputedStyle(item).getPropertyValue('--swatch').trim()
			const rgb = parseRgb(getComputedStyle(chip).backgroundColor)
			const badges = el('div', 'token-swatch__contrast')
			badges.append(
				contrastBadge('бел', contrast(rgb, [255, 255, 255])),
				contrastBadge('чёрн', contrast(rgb, [0, 0, 0]))
			)
			body.append(
				el('span', 'token-swatch__name', name),
				el('span', 'token-swatch__value', value),
				badges
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
		const meta = el('p', 'token-specimen__meta')
		const values = el('span', 'token-specimen__values')
		meta.append(el('span', 'token-specimen__name', name), values)
		const sample = el('p', `token-specimen__sample token-specimen--${name}`, SPECIMEN_TEXT)
		item.append(meta, sample)
		specimens.push({ sample, values })
		return item
	})
	list.replaceChildren(...items)
	updateSpecimens()
}

// Размеры зависят от ширины окна — подпись обновляется при смене ширины
function updateSpecimens() {
	for (const { sample, values } of specimens) {
		const style = getComputedStyle(sample)
		const size = Math.round(parseFloat(style.fontSize) * 10) / 10
		const lineHeight = parseFloat(style.lineHeight)
		const leading = Number.isNaN(lineHeight)
			? style.lineHeight
			: `${Math.round(lineHeight * 10) / 10}px`
		values.textContent = `${size}px / ${leading} · ${style.fontWeight}`
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
