// Согласие на cookie (контракт — docs/contracts/cookie-banner.md).
// - В разметке баннер скрыт: скрипт показывает его, только если выбора ещё нет (с появлением).
//   Так он не мелькает при перезагрузке, пока скрипт не запустился. Выбор («accepted» или
//   «declined») пишется в cookie на год, баннер скрывается.
// - Счётчики и прочее, что требует согласия, бэк выводит выключенными:
//   <script type="text/plain" data-cookie-consent src="…"></script> (или с кодом внутри).
//   После «Принять» (и на каждой следующей странице, если согласие уже есть) скрипт их включает.
//   Без согласия они не выполняются и cookie не ставят.
// - Передумать можно: любой элемент с data-cookie-settings (ссылка в подвале и т. п.) снова
//   показывает баннер. Отзыв согласия записывается, уже включённые счётчики работают до
//   перезагрузки страницы — их cookie бэк удаляет по «declined».
// - Выбор объявляется событием cookie-consent на document (detail.choice).
const YEAR = 60 * 60 * 24 * 365

const readCookie = (name) =>
	document.cookie
		.split('; ')
		.find((part) => part.startsWith(`${name}=`))
		?.slice(name.length + 1)

// Выключенные теги → настоящие <script> (браузер выполняет только вставленный заново тег)
const enableConsentScripts = () => {
	document.querySelectorAll('script[type="text/plain"][data-cookie-consent]').forEach((stub) => {
		const script = document.createElement('script')
		for (const { name, value } of stub.attributes) {
			if (name !== 'type' && name !== 'data-cookie-consent') script.setAttribute(name, value)
		}
		if (stub.dataset.cookieType) script.type = stub.dataset.cookieType
		script.text = stub.text
		stub.replaceWith(script)
	})
}

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const name = root.dataset.cookieName || 'ag_cookie_consent'
	const isStatic = root.classList.contains('cookie-banner--static')
	const saved = readCookie(name)

	if (saved === 'accepted') enableConsentScripts()

	// Выбора ещё нет — показываем (выезжает с анимацией появления)
	if (!isStatic && !saved) root.hidden = false

	root.addEventListener(
		'click',
		(event) => {
			const button = event.target.closest('[data-cookie-choice]')
			if (!button) return
			const choice = button.dataset.cookieChoice
			const secure = window.location.protocol === 'https:' ? '; Secure' : ''
			document.cookie = `${name}=${choice}; Max-Age=${YEAR}; Path=/; SameSite=Lax${secure}`
			if (choice === 'accepted') enableConsentScripts()
			document.dispatchEvent(new CustomEvent('cookie-consent', { detail: { choice } }))
			if (!isStatic) root.hidden = true
		},
		{ signal }
	)

	// «Настройки cookie»: показать баннер снова, чтобы изменить выбор
	document.addEventListener(
		'click',
		(event) => {
			const trigger = event.target.closest('[data-cookie-settings]')
			if (!trigger || isStatic) return
			event.preventDefault()
			root.hidden = false
			root.querySelector('[data-cookie-choice]')?.focus()
		},
		{ signal }
	)

	return () => controller.abort()
}
