import { announce } from '@/utils/announce'
import { lockBody } from '@/utils/scroll-lock'

// Фильтры списка в GET-форме: сайдбар с 1024 и панель на весь экран до 1024 (поиск, вакансии).
// - С 1024 (сайдбар): фильтр применяется сразу — форма отправляется при выборе (список с
//   мультивыбором — один раз, когда его закрыли: событие select:commit).
// - До 1024 (панель): кнопка [<open>="<id блока>"] открывает, [close]/Esc — закрывают без
//   применения (форма возвращается к исходным значениям). Выбор меняет только число на кнопке
//   [count] «Показать N …» (запрос на countUrl, без перезагрузки).
// - Отправка: пустые параметры в адрес не попадают (?q=иван&section=news, без «&date_from=»).
// options: open — имя атрибута кнопки открытия, close и count — селекторы, countUrl,
// countText(n) — надпись на кнопке.
const DESKTOP = '(min-width: 1024px)'
const COUNT_DELAY = 300

export const plural = (n, one, few, many) => {
	const mod10 = n % 10
	const mod100 = n % 100
	if (mod10 === 1 && mod100 !== 11) return one
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
	return many
}

// «Показать ещё N» в группе флажков: [data-filter-more] открывает спрятанные пункты
// [data-filter-extra] своей группы и ставит фокус на первый из них. Выбранный пункт среди
// спрятанных — группа открыта сразу. group — селектор группы.
export function filterMore(root, group) {
	const controller = new AbortController()

	const reveal = (element, focus = false) => {
		const extras = [...element.querySelectorAll('[data-filter-extra]')]
		extras.forEach((item) => (item.hidden = false))
		element.querySelector('[data-filter-more]')?.remove()
		if (focus) extras[0]?.querySelector('input')?.focus()
	}

	root.querySelectorAll(group).forEach((element) => {
		if (element.querySelector('[data-filter-extra] input:checked')) reveal(element)
	})
	root.addEventListener(
		'click',
		(event) => {
			const more = event.target.closest('[data-filter-more]')
			if (more) reveal(more.closest(group), true)
		},
		{ signal: controller.signal }
	)

	return () => controller.abort()
}

export function filterPanel(
	root,
	{ open: openAttr, close: closeSelector, count: countSelector, countUrl = '', countText }
) {
	const controller = new AbortController()
	const { signal } = controller
	const form = root.closest('form')
	const countButton = root.querySelector(countSelector)
	const media = window.matchMedia(DESKTOP)
	let release = null
	let opener = null
	let countTimer = 0
	let countRequest = null

	const isPanel = () => !media.matches
	const isOpen = () => root.classList.contains('is-open')

	const params = (data) => {
		const search = new URLSearchParams()
		for (const [key, value] of data) if (String(value).trim() !== '') search.append(key, value)
		return search
	}

	// Число результатов для кнопки панели
	const updateCount = () => {
		if (!countUrl || !countButton || !form) return
		clearTimeout(countTimer)
		countTimer = setTimeout(async () => {
			countRequest?.abort()
			const own = new AbortController()
			countRequest = own
			countButton.setAttribute('aria-busy', 'true')
			const url = new URL(countUrl, window.location.href)
			params(new FormData(form)).forEach((value, key) => url.searchParams.append(key, value))
			try {
				const response = await fetch(url, {
					signal: own.signal,
					headers: { Accept: 'application/json' },
					credentials: 'same-origin',
				})
				if (!response.ok) throw new Error(`HTTP ${response.status}`)
				const data = await response.json()
				if (own.signal.aborted || signal.aborted) return
				const count = Math.max(0, Number(data?.count) || 0)
				countButton.textContent = countText(count)
				announce(countButton.textContent)
			} catch {
				// Не посчитали — на кнопке остаётся прошлое число, применить всё равно можно
			} finally {
				if (countRequest === own) {
					countRequest = null
					countButton.removeAttribute('aria-busy')
				}
			}
		}, COUNT_DELAY)
	}

	const focusables = () =>
		[
			...root.querySelectorAll(
				'button, [href], input, select, [tabindex]:not([tabindex="-1"])'
			),
		].filter((el) => !el.disabled && el.offsetParent !== null && !el.closest('[hidden]'))

	const open = (trigger) => {
		if (isOpen() || !isPanel()) return
		opener = trigger || null
		root.classList.add('is-open')
		root.setAttribute('role', 'dialog')
		root.setAttribute('aria-modal', 'true')
		opener?.setAttribute('aria-expanded', 'true')
		release = lockBody()
		root.querySelector(closeSelector)?.focus()
	}

	const close = ({ discard = true } = {}) => {
		if (!isOpen()) return
		root.classList.remove('is-open')
		root.removeAttribute('role')
		root.removeAttribute('aria-modal')
		opener?.setAttribute('aria-expanded', 'false')
		release?.()
		release = null
		// Закрыли без «Показать» — выбор не применяется
		if (discard) form?.reset()
		opener?.focus()
		opener = null
	}

	document.addEventListener(
		'click',
		(event) => {
			const trigger = event.target.closest(`[${openAttr}="${CSS.escape(root.id)}"]`)
			if (!trigger) return
			event.preventDefault()
			open(trigger)
		},
		{ signal }
	)
	root.querySelector(closeSelector)?.addEventListener('click', () => close(), {
		signal,
	})

	root.addEventListener(
		'keydown',
		(event) => {
			if (!isOpen()) return
			// Esc закрывает панель, если его не забрал открытый список или календарь
			if (event.key === 'Escape' && !event.defaultPrevented) {
				event.preventDefault()
				close()
			}
			// Фокус не уходит из панели
			if (event.key === 'Tab') {
				const items = focusables()
				if (!items.length) return
				const first = items[0]
				const last = items[items.length - 1]
				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault()
					last.focus()
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault()
					first.focus()
				}
			}
		},
		{ signal }
	)

	// Выбор в фильтрах: сайдбар — применить, панель — пересчитать число
	const onChange = (event) => {
		if (!root.contains(event.target)) return
		const multiple = event.target instanceof HTMLSelectElement && event.target.multiple
		if (isPanel()) {
			updateCount()
			return
		}
		if (event.type === 'select:commit' || !multiple) form?.requestSubmit()
	}
	form?.addEventListener('change', onChange, { signal })
	form?.addEventListener('select:commit', onChange, { signal })

	// Отправка без пустых параметров
	form?.addEventListener(
		'submit',
		(event) => {
			if (event.defaultPrevented) return
			event.preventDefault()
			const search = params(new FormData(form, event.submitter || undefined))
			const url = new URL(
				form.getAttribute('action') || window.location.pathname,
				window.location.href
			)
			url.search = search.toString()
			release?.()
			release = null
			window.location.assign(url)
		},
		{ signal }
	)

	// Сменилась ширина через 1024 (окно сузили, планшет повернули): карточка и панель меняются
	// сразу, без появления и скрытия (класс is-instant на два кадра) — иначе карточка на миг
	// мелькала панелью на весь экран. Стали десктопом с открытой панелью — закрыть (выбор
	// сохраняется)
	let instantFrame = 0
	media.addEventListener(
		'change',
		() => {
			root.classList.add('is-instant')
			cancelAnimationFrame(instantFrame)
			instantFrame = requestAnimationFrame(() => {
				instantFrame = requestAnimationFrame(() => root.classList.remove('is-instant'))
			})
			if (media.matches) close({ discard: false })
		},
		{ signal }
	)

	return () => {
		controller.abort()
		cancelAnimationFrame(instantFrame)
		root.classList.remove('is-instant')
		clearTimeout(countTimer)
		countRequest?.abort()
		release?.()
		root.classList.remove('is-open')
	}
}
