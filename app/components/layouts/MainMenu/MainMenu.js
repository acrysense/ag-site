import { lockBody } from '@/utils/scroll-lock'

// Мобильное меню. Открывается кнопками с data-main-menu-open (бургер в шапке, «Меню» в
// TabBar). Немодальное: TabBar остаётся поверх и доступен, как в макете, а основная
// страница (.wrapper) на время открытия становится inert.
const desktop = window.matchMedia('(min-width: 1024px)')

export default function init(dialog) {
	const controller = new AbortController()
	const { signal } = controller
	let release = null
	let returnFocus = null

	// Свои кнопки — по aria-controls: на странице витрины экземпляров меню несколько
	const openers = () =>
		document.querySelectorAll(`[data-main-menu-open][aria-controls="${dialog.id}"]`)
	// Открытое заранее меню в витрине: только кнопки внутри, без реакции на страницу
	const isStatic = dialog.classList.contains('main-menu--static')
	const page = () => document.querySelector('.wrapper')

	const setOpeners = (open) => {
		for (const opener of openers()) {
			opener.setAttribute('aria-expanded', String(open))
			opener.classList.toggle('is-active', open)
		}
	}

	const open = (trigger) => {
		if (dialog.open) return
		returnFocus = trigger
		dialog.show()
		dialog.scrollTop = 0
		release?.()
		release = lockBody()
		const wrapper = page()
		if (wrapper) wrapper.inert = true
		setOpeners(true)
		dialog.querySelector('[data-main-menu-close]')?.focus()
	}

	// Уборка сразу при закрытии: событие close у <dialog> приходит асинхронно, и если
	// меню успели открыть снова, запоздавшее событие сняло бы уже новую блокировку
	const cleanup = () => {
		release?.()
		release = null
		const wrapper = page()
		if (wrapper) wrapper.inert = false
		setOpeners(false)
		// Фокус — туда, откуда открыли, если кнопка ещё видна
		if (returnFocus?.isConnected && returnFocus.offsetParent) returnFocus.focus()
		returnFocus = null
	}

	const close = () => {
		if (!dialog.open) return
		dialog.close()
		cleanup()
	}

	// Закрытие не через close() (например, form method="dialog") — уборка по событию
	dialog.addEventListener('close', () => !dialog.open && release && cleanup(), { signal })

	document.addEventListener(
		'click',
		(event) => {
			const trigger = event.target.closest('[data-main-menu-open]')
			if (!trigger || isStatic || trigger.getAttribute('aria-controls') !== dialog.id) return
			event.preventDefault()
			if (dialog.open) close()
			else open(trigger)
		},
		{ signal }
	)

	dialog.addEventListener(
		'click',
		(event) => {
			if (event.target.closest('[data-main-menu-close]')) {
				if (!isStatic) close()
				return
			}
			const group = event.target.closest('[data-main-menu-group]')
			if (!group) return
			const list = document.getElementById(group.getAttribute('aria-controls'))
			const expanded = group.getAttribute('aria-expanded') !== 'true'
			group.setAttribute('aria-expanded', String(expanded))
			if (list) list.hidden = !expanded
		},
		{ signal }
	)

	// Немодальный <dialog> не закрывается по Escape сам; шторка выхода — модальная и
	// закрывается своим Escape, поэтому при открытой шторке меню не трогаем
	document.addEventListener(
		'keydown',
		(event) => {
			if (event.key !== 'Escape' || !dialog.open || isStatic) return
			if (dialog.querySelector('dialog[open]')) return
			close()
		},
		{ signal }
	)

	desktop.addEventListener('change', () => desktop.matches && !isStatic && close(), { signal })

	return () => {
		controller.abort()
		if (!isStatic) close()
		release?.()
	}
}
