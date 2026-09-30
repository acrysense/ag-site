import './canvas.scss'
import './mock-server.js'

// ?story=<id> — одна история; &state=<n> — одно её состояние (так их открывает
// оболочка ui.html). Номер состояния — порядок в разметке истории, с нуля.
const params = new URLSearchParams(window.location.search)
const story = params.get('story')
const state = params.get('state')

for (const el of document.querySelectorAll('[data-story]')) {
	el.querySelectorAll('[data-state-label]').forEach((node, index) => {
		node.dataset.stateIndex = String(index)
	})
}

if (story) {
	document.documentElement.classList.add('is-single-story')
	for (const el of document.querySelectorAll('[data-story]')) {
		el.hidden = el.dataset.story !== story
	}
}

if (story && state !== null) {
	document.documentElement.classList.add('is-single-state')
	const current = document.querySelector(`[data-story="${CSS.escape(story)}"]`)
	for (const node of current?.querySelectorAll('[data-state-label]') || []) {
		node.hidden = node.dataset.stateIndex !== state
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

// Толщина линии иконки: рисуем символ из спрайта в 8 раз крупнее, строим карту расстояний
// до края и берём медиану по центральным линиям. Для разбора с дизайнером, только витрина.
const SCALE = 8

async function strokeWidth(name, size) {
	const symbol = document.getElementById(`icon-${name}`)
	if (!symbol) return null
	const box = symbol.getAttribute('viewBox')
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * SCALE}" height="${size * SCALE}" viewBox="${box}" color="#000">${symbol.innerHTML}</svg>`
	const image = new Image()
	image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
	await image.decode()

	const width = size * SCALE
	const canvas = document.createElement('canvas')
	canvas.width = canvas.height = width
	const context = canvas.getContext('2d')
	context.drawImage(image, 0, 0, width, width)
	const alpha = context.getImageData(0, 0, width, width).data

	const dist = new Float32Array(width * width)
	for (let i = 0; i < dist.length; i++) dist[i] = alpha[i * 4 + 3] > 127 ? 1e9 : 0
	const d2 = Math.SQRT2
	for (let y = 0; y < width; y++) {
		for (let x = 0; x < width; x++) {
			const i = y * width + x
			if (!dist[i]) continue
			let v = x && y ? dist[i] : 1
			if (x) v = Math.min(v, dist[i - 1] + 1)
			if (y) {
				v = Math.min(v, dist[i - width] + 1)
				if (x) v = Math.min(v, dist[i - width - 1] + d2)
				if (x < width - 1) v = Math.min(v, dist[i - width + 1] + d2)
			}
			dist[i] = v
		}
	}
	for (let y = width - 1; y >= 0; y--) {
		for (let x = width - 1; x >= 0; x--) {
			const i = y * width + x
			if (!dist[i]) continue
			let v = x < width - 1 && y < width - 1 ? dist[i] : 1
			if (x < width - 1) v = Math.min(v, dist[i + 1] + 1)
			if (y < width - 1) {
				v = Math.min(v, dist[i + width] + 1)
				if (x < width - 1) v = Math.min(v, dist[i + width + 1] + d2)
				if (x) v = Math.min(v, dist[i + width - 1] + d2)
			}
			dist[i] = v
		}
	}

	const ridge = []
	for (let y = 1; y < width - 1; y++) {
		for (let x = 1; x < width - 1; x++) {
			const i = y * width + x
			const v = dist[i]
			if (v < 1.5) continue
			if ([-1, 1, -width, width].every((o) => dist[i + o] <= v)) ridge.push(v)
		}
	}
	if (!ridge.length) return null
	ridge.sort((a, b) => a - b)
	return (2 * ridge[Math.floor(ridge.length / 2)] - 1) / SCALE
}

// Ориентир: иконки 20px в макете в основном 1.1–1.4px; тоньше 1 — заметно тоньше соседей
// В ряду иконки должны быть одной толщины: разброс больше 0.25px уже заметен глазом
const ROW_SPREAD = 0.25

async function renderIconStrokes() {
	for (const node of document.querySelectorAll('[data-icon-stroke]')) {
		const name = node.closest('[data-icon]').dataset.icon
		const sizes = node.dataset.sizes.trim().split(/\s+/).map(Number)
		const values = []
		for (const size of sizes) {
			const value = await strokeWidth(name, size)
			if (value !== null) values.push({ size, value })
		}
		const filled = name.endsWith('-filled')
		node.dataset.stroke = values.length ? String(values[0].value) : ''
		const inRow = node.closest('[data-icon-row]')
		node.textContent = filled
			? 'залитая — толщина не считается'
			: inRow
				? `${values[0]?.value.toFixed(2)}`
				: values.map(({ size, value }) => `${value.toFixed(2)}px при ${size}px`).join(' · ')
		const min = Math.min(...values.map(({ value }) => value))
		const max = Math.max(...values.map(({ value }) => value))
		if (!node.closest('[data-icon-row]')) {
			node.classList.toggle('is-thin', !filled && min < 1)
			node.classList.toggle('is-thick', !filled && max > 1.6)
		}
	}

	for (const row of document.querySelectorAll('[data-icon-row]')) {
		const strokes = [...row.querySelectorAll('[data-icon-stroke]')]
			.map((node) => Number(node.dataset.stroke))
			.filter((value) => value > 0)
		const spread = Math.max(...strokes) - Math.min(...strokes)
		const label = row.querySelector('[data-row-spread]')
		label.textContent = `толщина ${Math.min(...strokes).toFixed(2)}–${Math.max(...strokes).toFixed(2)}px, разброс ${spread.toFixed(2)}px`
		label.classList.toggle('is-uneven', spread > ROW_SPREAD)
		// Выбивающиеся в ряду — дальше всех от медианы ряда
		const median = [...strokes].sort((a, b) => a - b)[Math.floor(strokes.length / 2)]
		for (const node of row.querySelectorAll('[data-icon-stroke]')) {
			const off = Math.abs(Number(node.dataset.stroke) - median) > ROW_SPREAD / 2 + 0.01
			node.classList.toggle('is-thick', off && spread > ROW_SPREAD)
		}
	}
}

// Спрайт монтируется на DOMContentLoaded — ждём его
if (document.querySelector('[data-icon-list]')) {
	window.addEventListener('load', renderIconStrokes, { once: true })
}
