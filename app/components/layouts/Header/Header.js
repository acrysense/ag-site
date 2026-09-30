// Шапка: подменю открываются наведением мышью на десктопе, нажатием на стрелку
// (тач, клавиатура) и закрываются по Escape, клику снаружи и уходу фокуса.
// Бургер показывает меню на мобильном.
const desktop = window.matchMedia('(min-width: 1024px)')

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const items = [...root.querySelectorAll('[data-submenu]')]
	const burger = root.querySelector('[data-header-burger]')

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

	burger?.addEventListener(
		'click',
		() => {
			const open = burger.getAttribute('aria-expanded') !== 'true'
			burger.setAttribute('aria-expanded', String(open))
			root.classList.toggle('is-nav-open', open)
		},
		{ signal }
	)

	// На десктопе мобильное состояние бургера не нужно
	desktop.addEventListener(
		'change',
		() => {
			closeAll()
			burger?.setAttribute('aria-expanded', 'false')
			root.classList.remove('is-nav-open')
		},
		{ signal }
	)

	return () => controller.abort()
}
