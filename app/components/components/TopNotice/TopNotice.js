// Плашка-объявление над шапкой (контракт — docs/contracts/top-notice.md).
// - Крестик — плашка сворачивается по высоте (миксин expand) и запоминается в cookie до конца
//   дня: значение — key плашки. Новое объявление (другой key) показывается снова.
// - Бэк по cookie может плашку не выводить; если страница отдана из кеша с плашкой — скрипт
//   прячет её сам, без анимации.
// - Фокус был на крестике — переходит на первую ссылку шапки, а не теряется.

const readCookie = (name) =>
	document.cookie
		.split('; ')
		.find((part) => part.startsWith(`${name}=`))
		?.slice(name.length + 1)

export default function init(root) {
	const controller = new AbortController()
	const name = root.dataset.cookieName || 'ag_top_notice'
	const key = encodeURIComponent(root.dataset.key || 'global')

	// Закрыта сегодня (страница из кеша) — сразу, без сворачивания
	if (readCookie(name) === key) {
		root.hidden = true
		root.getAnimations().forEach((animation) => animation.finish())
	}

	root.querySelector('[data-top-notice-close]')?.addEventListener(
		'click',
		(event) => {
			const end = new Date()
			end.setHours(23, 59, 59, 999)
			const secure = window.location.protocol === 'https:' ? '; Secure' : ''
			document.cookie = `${name}=${key}; Expires=${end.toUTCString()}; Path=/; SameSite=Lax${secure}`
			const hadFocus = document.activeElement === event.currentTarget
			root.hidden = true
			if (hadFocus) root.nextElementSibling?.querySelector('a[href], button')?.focus()
		},
		{ signal: controller.signal }
	)

	return () => controller.abort()
}
