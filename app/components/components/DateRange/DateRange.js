import { createCalendar, formatDate, fromIso } from '@/components/components/Calendar/Calendar'
import { isSheet, lockIfSheet } from '@/utils/sheet'

// Поле периода: кнопка «07.09.2026 — 18.09.2026» (пусто — подпись серым) и календарь в окне.
// Выбор в календаре — черновик: в поля формы он попадает по «Применить» («Сбросить» — очищает);
// закрытие без «Применить» (Esc, клик вне, ×) черновик отбрасывает. После записи — change на
// поле «с», с data-date-range-submit — отправка формы.
const SVG = 'http://www.w3.org/2000/svg'
let counter = 0

const icon = (name, className) => {
	const svg = document.createElementNS(SVG, 'svg')
	svg.setAttribute('class', `icon ${className}`)
	svg.setAttribute('aria-hidden', 'true')
	svg.setAttribute('focusable', 'false')
	const use = document.createElementNS(SVG, 'use')
	use.setAttribute('href', `#icon-${name}`)
	svg.append(use)
	return svg
}

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const inputFrom = root.querySelector('[data-date-range-from]')
	const inputTo = root.querySelector('[data-date-range-to]')
	if (!inputFrom || !inputTo) return () => controller.abort()
	const placeholder = root.dataset.placeholder || 'Период'
	const id = `date-range-${++counter}`
	let release = null
	let resetTimer = 0

	const field = document.createElement('button')
	field.type = 'button'
	field.className = 'date-range__field'
	field.setAttribute('aria-haspopup', 'dialog')
	field.setAttribute('aria-expanded', 'false')
	field.setAttribute('aria-controls', `${id}-popup`)
	const value = document.createElement('span')
	value.className = 'date-range__value'
	field.append(value, icon('calendar', 'date-range__icon'))

	const backdrop = document.createElement('div')
	backdrop.className = 'date-range__backdrop'
	backdrop.hidden = true

	const popup = document.createElement('div')
	popup.className = 'date-range__popup'
	popup.id = `${id}-popup`
	popup.hidden = true
	popup.setAttribute('role', 'dialog')
	popup.setAttribute('aria-label', placeholder)

	// Шапка листа (видна только на мобильном): подпись и ×
	const head = document.createElement('div')
	head.className = 'date-range__head'
	const title = document.createElement('p')
	title.className = 'date-range__title'
	title.textContent = placeholder
	const closeButton = document.createElement('button')
	closeButton.type = 'button'
	closeButton.className = 'date-range__close'
	closeButton.setAttribute('aria-label', 'Закрыть')
	closeButton.append(icon('close', 'date-range__close-icon'))
	head.append(title, closeButton)
	popup.append(head)

	const sync = () => {
		const from = fromIso(inputFrom.value)
		const to = fromIso(inputTo.value) || from
		value.textContent = from ? `${formatDate(from)} — ${formatDate(to)}` : placeholder
		root.classList.toggle('is-placeholder', !from)
		field.setAttribute(
			'aria-label',
			from ? `${placeholder}: ${value.textContent}` : placeholder
		)
	}

	const isOpen = () => !popup.hidden

	const close = ({ focus = false } = {}) => {
		if (!isOpen()) return
		popup.hidden = true
		backdrop.hidden = true
		root.classList.remove('is-open', 'is-up')
		field.setAttribute('aria-expanded', 'false')
		release?.()
		release = null
		if (focus) field.focus()
	}

	const commit = (from, to) => {
		const changed = inputFrom.value !== from || inputTo.value !== to
		inputFrom.value = from
		inputTo.value = to
		sync()
		close({ focus: true })
		if (!changed) return
		inputFrom.dispatchEvent(new Event('change', { bubbles: true }))
		if (root.hasAttribute('data-date-range-submit')) inputFrom.form?.requestSubmit()
	}

	const calendar = createCalendar(popup, {
		from: inputFrom.value,
		to: inputTo.value,
		onApply: ({ from, to }) => commit(from, to),
		onReset: () => commit('', ''),
	})

	const open = () => {
		if (isOpen()) return
		calendar.set({ from: inputFrom.value, to: inputTo.value })
		popup.hidden = false
		backdrop.hidden = false
		root.classList.add('is-open')
		field.setAttribute('aria-expanded', 'true')
		release = lockIfSheet()
		// Мало места снизу — окно над полем (кроме листа)
		if (!isSheet()) {
			const rect = field.getBoundingClientRect()
			const below = window.innerHeight - rect.bottom
			root.classList.toggle('is-up', below < popup.offsetHeight + 12 && rect.top > below)
		}
		calendar.focus()
	}

	field.addEventListener('click', () => (isOpen() ? close() : open()), { signal })
	closeButton.addEventListener('click', () => close({ focus: true }), { signal })
	backdrop.addEventListener('click', () => close({ focus: true }), { signal })
	root.addEventListener(
		'keydown',
		(event) => {
			if (event.key === 'Escape' && isOpen()) {
				event.preventDefault()
				event.stopPropagation()
				close({ focus: true })
			}
		},
		{ signal }
	)
	document.addEventListener(
		'pointerdown',
		(event) => {
			if (isOpen() && !root.contains(event.target)) close()
		},
		{ signal }
	)
	root.addEventListener(
		'focusout',
		(event) => {
			if (isOpen() && event.relatedTarget && !root.contains(event.relatedTarget)) close()
		},
		{ signal }
	)
	// Сброс формы — поле снова пустое (событие reset приходит до очистки полей)
	inputFrom.form?.addEventListener(
		'reset',
		() => {
			clearTimeout(resetTimer)
			resetTimer = setTimeout(sync)
		},
		{ signal }
	)

	root.append(field, backdrop, popup)
	root.classList.add('is-enhanced')
	sync()

	return () => {
		controller.abort()
		clearTimeout(resetTimer)
		release?.()
		calendar.destroy()
		field.remove()
		backdrop.remove()
		popup.remove()
		root.classList.remove('is-enhanced', 'is-open', 'is-up', 'is-placeholder')
	}
}
