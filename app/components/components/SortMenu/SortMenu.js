import { lockBody } from '@/utils/scroll-lock'

// Меню сортировки: по клику на текущий порядок — список вариантов (ссылки). С 768 — выпадающий
// список под кнопкой (не влезает слева — по левому краю кнопки, класс is-start), до 768 — нижний
// лист с затемнением, прокрутка страницы на это время заблокирована. Закрывается выбором, ×,
// затемнением, Escape (фокус — на кнопку), кликом мимо и уходом фокуса. Открыли с клавиатуры —
// фокус на текущий вариант.
const MOBILE = '(max-width: 767.98px)'

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const toggle = root.querySelector('.sort-menu__toggle')
	const popup = root.querySelector('.sort-menu__popup')
	const backdrop = root.querySelector('.sort-menu__backdrop')
	const media = window.matchMedia(MOBILE)
	let release = null
	if (!toggle || !popup) return () => {}

	const isOpen = () => root.classList.contains('is-open')
	const setOpen = (open, { focus = false } = {}) => {
		root.classList.toggle('is-open', open)
		toggle.setAttribute('aria-expanded', String(open))
		popup.hidden = !open
		if (backdrop) backdrop.hidden = !open || !media.matches
		release?.()
		release = open && media.matches ? lockBody() : null
		if (!open) return
		root.classList.remove('is-start')
		if (!media.matches && popup.getBoundingClientRect().left < 0) root.classList.add('is-start')
		if (focus) (popup.querySelector('[aria-current]') || popup.querySelector('a'))?.focus()
	}

	// detail 0 — нажатие с клавиатуры (Enter, пробел)
	toggle.addEventListener('click', (event) => setOpen(!isOpen(), { focus: event.detail === 0 }), {
		signal,
	})
	root.addEventListener(
		'click',
		(event) => {
			if (event.target.closest('[data-sort-menu-close]')) setOpen(false)
		},
		{ signal }
	)
	root.addEventListener(
		'focusout',
		(event) => {
			if (event.relatedTarget && !root.contains(event.relatedTarget)) setOpen(false)
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
	media.addEventListener('change', () => isOpen() && setOpen(false), { signal })

	return () => {
		controller.abort()
		setOpen(false)
	}
}
