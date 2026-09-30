// Согласие на cookie: выбор («accepted» или «declined») пишется в cookie на год, баннер
// скрывается. Если cookie уже есть (страница из кеша) — баннер скрывается сразу. Выбор
// объявляется событием cookie-consent на document (detail.choice) — для счётчиков.
const YEAR = 60 * 60 * 24 * 365

const readCookie = (name) =>
	document.cookie
		.split('; ')
		.find((part) => part.startsWith(`${name}=`))
		?.slice(name.length + 1)

export default function init(root) {
	const controller = new AbortController()
	const name = root.dataset.cookieName || 'ag_cookie_consent'
	const isStatic = root.classList.contains('cookie-banner--static')

	if (!isStatic && readCookie(name)) {
		root.hidden = true
		return () => controller.abort()
	}

	root.addEventListener(
		'click',
		(event) => {
			const button = event.target.closest('[data-cookie-choice]')
			if (!button) return
			const choice = button.dataset.cookieChoice
			const secure = window.location.protocol === 'https:' ? '; Secure' : ''
			document.cookie = `${name}=${choice}; Max-Age=${YEAR}; Path=/; SameSite=Lax${secure}`
			document.dispatchEvent(new CustomEvent('cookie-consent', { detail: { choice } }))
			if (!isStatic) root.hidden = true
		},
		{ signal: controller.signal }
	)

	return () => controller.abort()
}
