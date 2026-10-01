// Шапка: подменю открываются наведением мышью на десктопе, нажатием на стрелку
// (тач, клавиатура) и закрываются по Escape, клику снаружи и уходу фокуса.
// Бургер открывает мобильное меню (layouts/MainMenu) через data-main-menu-open.
// Меню под аватаром [data-user-menu]: по клику; закрывается по Escape (фокус — на аватар),
// клику снаружи, уходу фокуса и выбору пункта.
const desktop = window.matchMedia('(min-width: 1024px)')

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const items = [...root.querySelectorAll('[data-submenu]')]

	const toggleOf = (item) => item.querySelector('[data-submenu-toggle]')

	const setOpen = (item, open) => {
		toggleOf(item).setAttribute('aria-expanded', String(open))
		item.querySelector('.menu__submenu').hidden = !open
		item.classList.toggle('is-open', open)
	}

	const closeAll = (except) => {
		for (const item of items) if (item !== except) setOpen(item, false)
	}

	for (const item of items) {
		toggleOf(item).addEventListener(
			'click',
			() => {
				const open = !item.classList.contains('is-open')
				closeAll(item)
				setOpen(item, open)
			},
			{ signal }
		)

		item.addEventListener(
			'pointerenter',
			(event) => {
				if (event.pointerType !== 'mouse' || !desktop.matches) return
				closeAll(item)
				setOpen(item, true)
			},
			{ signal }
		)

		item.addEventListener(
			'pointerleave',
			(event) => {
				if (event.pointerType === 'mouse' && desktop.matches) setOpen(item, false)
			},
			{ signal }
		)

		item.addEventListener(
			'focusout',
			(event) => {
				if (!item.contains(event.relatedTarget)) setOpen(item, false)
			},
			{ signal }
		)
	}

	document.addEventListener(
		'keydown',
		(event) => {
			if (event.key !== 'Escape') return
			const open = items.find((item) => item.classList.contains('is-open'))
			if (!open) return
			setOpen(open, false)
			toggleOf(open).focus()
		},
		{ signal }
	)

	document.addEventListener(
		'click',
		(event) => {
			if (!root.contains(event.target)) closeAll()
		},
		{ signal }
	)

	desktop.addEventListener('change', () => closeAll(), { signal })

	const userMenu = root.querySelector('[data-user-menu]')
	if (userMenu) {
		const toggle = userMenu.querySelector('[data-user-menu-toggle]')
		const panel = userMenu.querySelector('.user-menu')
		const isOpen = () => userMenu.classList.contains('is-open')
		const setUserMenu = (open) => {
			toggle.setAttribute('aria-expanded', String(open))
			panel.hidden = !open
			userMenu.classList.toggle('is-open', open)
		}

		toggle.addEventListener(
			'click',
			() => {
				closeAll()
				setUserMenu(!isOpen())
			},
			{ signal }
		)
		panel.addEventListener(
			'click',
			(event) => event.target.closest('a') && setUserMenu(false),
			{
				signal,
			}
		)
		userMenu.addEventListener(
			'focusout',
			(event) => {
				if (!userMenu.contains(event.relatedTarget)) setUserMenu(false)
			},
			{ signal }
		)
		document.addEventListener(
			'click',
			(event) => {
				if (isOpen() && !userMenu.contains(event.target)) setUserMenu(false)
			},
			{ signal }
		)
		document.addEventListener(
			'keydown',
			(event) => {
				if (event.key !== 'Escape' || !isOpen()) return
				setUserMenu(false)
				toggle.focus()
			},
			{ signal }
		)
	}

	return () => controller.abort()
}
