// Меню сортировки: по клику на текущий порядок — список вариантов (ссылки). Закрывается выбором,
// Escape (фокус — на кнопку), кликом мимо и уходом фокуса из меню. С клавиатуры — Tab по пунктам.
// Не влезает слева — выравнивается по левому краю кнопки (класс is-start).
export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const toggle = root.querySelector('.sort-menu__toggle')
	const list = root.querySelector('.sort-menu__list')
	if (!toggle || !list) return () => {}

	const isOpen = () => root.classList.contains('is-open')
	// Меню по правому краю кнопки; если так не влезает в экран слева (кнопка перенеслась под
	// заголовок, к левому краю), — по левому
	const setOpen = (open) => {
		root.classList.toggle('is-open', open)
		toggle.setAttribute('aria-expanded', String(open))
		list.hidden = !open
		if (!open) return
		root.classList.remove('is-start')
		if (list.getBoundingClientRect().left < 0) root.classList.add('is-start')
	}

	toggle.addEventListener('click', () => setOpen(!isOpen()), { signal })
	root.addEventListener(
		'focusout',
		(event) => {
			if (!root.contains(event.relatedTarget)) setOpen(false)
		},
		{ signal }
	)
	document.addEventListener(
		'click',
		(event) => {
			if (isOpen() && !root.contains(event.target)) setOpen(false)
		},
		{ signal }
	)
	document.addEventListener(
		'keydown',
		(event) => {
			if (event.key !== 'Escape' || !isOpen()) return
			setOpen(false)
			toggle.focus()
		},
		{ signal }
	)

	return () => {
		controller.abort()
		setOpen(false)
	}
}
