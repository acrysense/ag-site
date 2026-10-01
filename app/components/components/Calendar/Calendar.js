// Календарь выбора периода (Figma: Calendar.Range 4743:2251 — режимы Custom, Week, Month, Year;
// пресеты — 4743:37841). Общий компонент: поле периода (DateRange), фильтры поиска, дальше —
// любые формы с датами.
//
// - Произвольный период: первый клик — начало, второй — конец (раньше начала — меняются местами).
// - Пресеты: Неделя — текущая пн–вс, Месяц — текущий месяц, Год — текущий год (сетка месяцев).
//   Повторный клик по активному пресету снимает его. Клик по дате после пресета — свой период.
// - Сегодня — синяя обводка, выходные в шапке — синие, дни чужого месяца — серые.
// - Клавиатура: фокус ходит стрелками (±день, ±неделя), PageUp/PageDown — месяц (год в сетке
//   месяцев), Home/End — начало/конец недели; Enter и пробел — выбрать.
//
// createCalendar(container, { from, to, onChange, onApply, onReset }) → { get, set, destroy }.
// from/to — строки YYYY-MM-DD или ''. onApply/onReset — есть, значит, есть кнопки
// «Применить»/«Сбросить».
import { createIcon as icon } from '@/utils/icon'
const MONTHS = [
	'Январь',
	'Февраль',
	'Март',
	'Апрель',
	'Май',
	'Июнь',
	'Июль',
	'Август',
	'Сентябрь',
	'Октябрь',
	'Ноябрь',
	'Декабрь',
]
const MONTHS_GENITIVE = [
	'января',
	'февраля',
	'марта',
	'апреля',
	'мая',
	'июня',
	'июля',
	'августа',
	'сентября',
	'октября',
	'ноября',
	'декабря',
]
const MONTHS_SHORT = [
	'Янв',
	'Фев',
	'Мар',
	'Апр',
	'Май',
	'Июн',
	'Июл',
	'Авг',
	'Сен',
	'Окт',
	'Ноя',
	'Дек',
]
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const PRESETS = [
	['week', 'Неделя'],
	['month', 'Месяц'],
	['year', 'Год'],
]

const pad = (n) => String(n).padStart(2, '0')
export const toIso = (date) =>
	date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : ''
export const fromIso = (value) => {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
	if (!match) return null
	const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
	return Number.isNaN(date.getTime()) ? null : date
}
export const formatDate = (date) =>
	date ? `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}` : ''

const day = (year, month, date) => new Date(year, month, date)
const same = (a, b) => Boolean(a && b) && a.getTime() === b.getTime()
const addDays = (date, n) => day(date.getFullYear(), date.getMonth(), date.getDate() + n)
const mondayIndex = (date) => (date.getDay() + 6) % 7
const startOfDay = (date) => day(date.getFullYear(), date.getMonth(), date.getDate())

const button = (className, text) => {
	const el = document.createElement('button')
	el.type = 'button'
	el.className = className
	if (text) el.textContent = text
	return el
}

export function createCalendar(container, options = {}) {
	const controller = new AbortController()
	const { signal } = controller
	const today = startOfDay(options.today || new Date())
	let from = fromIso(options.from)
	let to = fromIso(options.to)
	if (from && to && to < from) [from, to] = [to, from]
	let preset = null
	let mode = 'days' // days | months
	let pendingMonth = false // сетка месяцев: выбран первый месяц, ждём второй
	let hover = null
	const anchor = from || today
	let view = { year: anchor.getFullYear(), month: anchor.getMonth() }
	let focusDate = from || today

	const root = document.createElement('div')
	root.className = 'calendar'

	const presets = document.createElement('div')
	presets.className = 'calendar__presets'
	presets.setAttribute('role', 'group')
	presets.setAttribute('aria-label', 'Быстрый выбор периода')
	const presetButtons = PRESETS.map(([key, text]) => {
		const el = button('calendar__preset', text)
		el.dataset.preset = key
		el.setAttribute('aria-pressed', 'false')
		presets.append(el)
		return el
	})

	const head = document.createElement('div')
	head.className = 'calendar__head'
	const prev = button('calendar__nav')
	prev.append(icon('arrow-left', 'calendar__nav-icon'))
	const next = button('calendar__nav calendar__nav--next')
	next.append(icon('arrow-left', 'calendar__nav-icon'))
	const title = document.createElement('p')
	title.className = 'calendar__title'
	title.setAttribute('aria-live', 'polite')
	head.append(prev, title, next)

	const weekdays = document.createElement('div')
	weekdays.className = 'calendar__weekdays'
	weekdays.setAttribute('aria-hidden', 'true')
	WEEKDAYS.forEach((name, index) => {
		const span = document.createElement('span')
		span.className = `calendar__weekday${index > 4 ? ' is-weekend' : ''}`
		span.textContent = name
		weekdays.append(span)
	})

	const grid = document.createElement('div')
	grid.className = 'calendar__grid'
	grid.setAttribute('role', 'group')

	root.append(presets, head, weekdays, grid)

	let applyButton = null
	let resetButton = null
	if (options.onApply || options.onReset) {
		const actions = document.createElement('div')
		actions.className = 'calendar__actions'
		resetButton = button('btn btn--light btn--m calendar__reset', 'Сбросить')
		applyButton = button('btn btn--general btn--m calendar__apply', 'Применить')
		actions.append(resetButton, applyButton)
		root.append(actions)
	}
	container.append(root)

	const emit = () => options.onChange?.({ from: toIso(from), to: toIso(to), preset })

	// Диапазон для подсветки: выбранный или предпросмотр при наведении (есть начало, нет конца)
	const range = () => {
		if (from && !to && hover && mode === 'days')
			return hover < from ? [hover, from] : [from, hover]
		return [from, to || from]
	}

	const dayLabel = (date) =>
		`${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`

	const renderDays = () => {
		const first = day(view.year, view.month, 1)
		const start = addDays(first, -mondayIndex(first))
		const [a, b] = range()
		const cells = []
		for (let i = 0; i < 42; i++) {
			const date = addDays(start, i)
			const cell = button('calendar__day', String(date.getDate()))
			cell.dataset.date = toIso(date)
			cell.setAttribute('aria-label', dayLabel(date))
			const outside = date.getMonth() !== view.month
			const isStart = same(date, a)
			const isEnd = same(date, b)
			const inRange = a && b && date >= a && date <= b
			cell.classList.toggle('is-outside', outside)
			cell.classList.toggle('is-in-range', Boolean(inRange))
			cell.classList.toggle('is-start', isStart)
			cell.classList.toggle('is-end', isEnd)
			cell.classList.toggle('is-today', same(date, today))
			cell.setAttribute('aria-pressed', String(Boolean(isStart || isEnd)))
			if (same(date, today)) cell.setAttribute('aria-current', 'date')
			cell.tabIndex = same(date, focusDate) ? 0 : -1
			cells.push(cell)
		}
		// Фокусной даты нет в сетке (листали) — в порядок табуляции встаёт 1-е число
		if (!cells.some((cell) => cell.tabIndex === 0))
			cells.find((cell) => !cell.classList.contains('is-outside')).tabIndex = 0
		grid.replaceChildren(...cells)
		grid.className = 'calendar__grid'
		title.textContent = `${MONTHS[view.month]} ${view.year}`
		prev.setAttribute('aria-label', 'Предыдущий месяц')
		next.setAttribute('aria-label', 'Следующий месяц')
		weekdays.hidden = false
	}

	const renderMonths = () => {
		const cells = MONTHS_SHORT.map((name, index) => {
			const first = day(view.year, index, 1)
			const last = day(view.year, index + 1, 0)
			const cell = button('calendar__month', name)
			cell.dataset.month = String(index)
			cell.setAttribute('aria-label', `${MONTHS[index]} ${view.year}`)
			const isStart = from && same(first, day(from.getFullYear(), from.getMonth(), 1))
			const isEnd = to && same(last, day(to.getFullYear(), to.getMonth() + 1, 0))
			const inRange =
				from && to && first >= day(from.getFullYear(), from.getMonth(), 1) && last <= to
			cell.classList.toggle('is-in-range', Boolean(inRange))
			cell.classList.toggle('is-start', Boolean(isStart))
			cell.classList.toggle('is-end', Boolean(isEnd))
			cell.classList.toggle(
				'is-today',
				today.getFullYear() === view.year && today.getMonth() === index
			)
			cell.setAttribute('aria-pressed', String(Boolean(isStart || isEnd)))
			cell.tabIndex =
				focusDate.getFullYear() === view.year && focusDate.getMonth() === index ? 0 : -1
			return cell
		})
		if (!cells.some((cell) => cell.tabIndex === 0)) cells[0].tabIndex = 0
		grid.replaceChildren(...cells)
		grid.className = 'calendar__grid calendar__grid--months'
		title.textContent = String(view.year)
		prev.setAttribute('aria-label', 'Предыдущий год')
		next.setAttribute('aria-label', 'Следующий год')
		weekdays.hidden = true
	}

	const render = () => {
		presetButtons.forEach((el) =>
			el.setAttribute('aria-pressed', String(el.dataset.preset === preset))
		)
		if (mode === 'months') renderMonths()
		else renderDays()
		if (resetButton) resetButton.disabled = !from
	}

	const focusCurrent = () => grid.querySelector('[tabindex="0"]')?.focus()

	const applyPreset = (key) => {
		if (preset === key) {
			preset = null
			from = null
			to = null
			mode = 'days'
		} else {
			preset = key
			const y = today.getFullYear()
			const m = today.getMonth()
			if (key === 'week') {
				from = addDays(today, -mondayIndex(today))
				to = addDays(from, 6)
			} else if (key === 'month') {
				from = day(y, m, 1)
				to = day(y, m + 1, 0)
			} else {
				from = day(y, 0, 1)
				to = day(y, 11, 31)
			}
			mode = key === 'year' ? 'months' : 'days'
			view = { year: y, month: m }
			focusDate = from
		}
		pendingMonth = false
		render()
		emit()
	}

	const pickDay = (date) => {
		preset = null
		if (!from || to) {
			from = date
			to = null
		} else if (date < from) {
			to = from
			from = date
		} else to = date
		focusDate = date
		if (date.getMonth() !== view.month || date.getFullYear() !== view.year)
			view = { year: date.getFullYear(), month: date.getMonth() }
		render()
		focusCurrent()
		emit()
	}

	// Сетка месяцев: первый клик — месяц целиком, второй — продлить период до другого месяца
	const pickMonth = (index) => {
		preset = null
		const first = day(view.year, index, 1)
		const last = day(view.year, index + 1, 0)
		if (!pendingMonth || !from) {
			from = first
			to = last
			pendingMonth = true
		} else {
			if (first < from) from = first
			else to = last
			pendingMonth = false
		}
		focusDate = first
		render()
		focusCurrent()
		emit()
	}

	const shiftView = (step) => {
		if (mode === 'months') view = { ...view, year: view.year + step }
		else {
			const date = day(view.year, view.month + step, 1)
			view = { year: date.getFullYear(), month: date.getMonth() }
		}
		render()
	}

	presets.addEventListener(
		'click',
		(event) => {
			const el = event.target.closest('[data-preset]')
			if (el) applyPreset(el.dataset.preset)
		},
		{ signal }
	)
	prev.addEventListener('click', () => shiftView(-1), { signal })
	next.addEventListener('click', () => shiftView(1), { signal })

	grid.addEventListener(
		'click',
		(event) => {
			const cell = event.target.closest('button')
			if (!cell) return
			if (cell.dataset.date) pickDay(fromIso(cell.dataset.date))
			else pickMonth(Number(cell.dataset.month))
		},
		{ signal }
	)

	// Предпросмотр периода при наведении — только подсветка, без перерисовки кнопок
	const paintHover = () => {
		const [a, b] = range()
		grid.querySelectorAll('.calendar__day').forEach((cell) => {
			const date = fromIso(cell.dataset.date)
			cell.classList.toggle('is-in-range', Boolean(a && b && date >= a && date <= b))
			cell.classList.toggle('is-start', same(date, a))
			cell.classList.toggle('is-end', same(date, b))
		})
	}
	grid.addEventListener(
		'mouseover',
		(event) => {
			const cell = event.target.closest('.calendar__day')
			if (!cell || !from || to) return
			hover = fromIso(cell.dataset.date)
			paintHover()
		},
		{ signal }
	)
	grid.addEventListener(
		'mouseleave',
		() => {
			if (!hover) return
			hover = null
			paintHover()
		},
		{ signal }
	)

	grid.addEventListener(
		'keydown',
		(event) => {
			const steps =
				mode === 'months'
					? { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }
					: { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
			let target = null
			if (event.key in steps) {
				target =
					mode === 'months'
						? day(focusDate.getFullYear(), focusDate.getMonth() + steps[event.key], 1)
						: addDays(focusDate, steps[event.key])
			} else if (event.key === 'PageUp' || event.key === 'PageDown') {
				const step = event.key === 'PageUp' ? -1 : 1
				target =
					mode === 'months'
						? day(focusDate.getFullYear() + step, focusDate.getMonth(), 1)
						: day(
								focusDate.getFullYear(),
								focusDate.getMonth() + step,
								focusDate.getDate()
							)
			} else if (mode === 'days' && (event.key === 'Home' || event.key === 'End')) {
				target = addDays(
					focusDate,
					event.key === 'Home' ? -mondayIndex(focusDate) : 6 - mondayIndex(focusDate)
				)
			}
			if (!target) return
			event.preventDefault()
			focusDate = target
			if (mode === 'months') view = { ...view, year: target.getFullYear() }
			else view = { year: target.getFullYear(), month: target.getMonth() }
			render()
			focusCurrent()
		},
		{ signal }
	)

	applyButton?.addEventListener(
		'click',
		() => options.onApply?.({ from: toIso(from), to: toIso(to || from) }),
		{
			signal,
		}
	)
	resetButton?.addEventListener(
		'click',
		() => {
			from = null
			to = null
			preset = null
			mode = 'days'
			render()
			emit()
			options.onReset?.()
		},
		{ signal }
	)

	render()

	return {
		root,
		focus: focusCurrent,
		get: () => ({ from: toIso(from), to: toIso(to || from), preset }),
		set(value = {}) {
			from = fromIso(value.from)
			to = fromIso(value.to)
			if (from && to && to < from) [from, to] = [to, from]
			preset = null
			mode = 'days'
			pendingMonth = false
			hover = null
			const shown = from || today
			view = { year: shown.getFullYear(), month: shown.getMonth() }
			focusDate = shown
			render()
		},
		destroy() {
			controller.abort()
			root.remove()
		},
	}
}

// Отдельно на странице (витрина): <div data-module="Calendar" data-path="components"
// data-from="" data-to=""> — календарь без кнопок, выбор пишется в data-from/data-to
export default function init(el) {
	const calendar = createCalendar(el, {
		from: el.dataset.from,
		to: el.dataset.to,
		onChange: ({ from, to }) => {
			el.dataset.from = from
			el.dataset.to = to
		},
	})
	return () => calendar.destroy()
}
