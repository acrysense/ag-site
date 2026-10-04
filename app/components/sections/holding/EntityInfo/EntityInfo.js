// Карточка юрлица: «Скрыть описание» сворачивает описание и фото (hidden), надпись меняется на
// «Показать описание». Кнопка видна только с JS — без него описание всегда открыто.
export default function init(root) {
	const controller = new AbortController()
	const toggle = root.querySelector('[data-entity-toggle]')
	const about = root.querySelector('[data-entity-about]')
	const text = root.querySelector('[data-entity-toggle-text]')
	if (!toggle || !about) return () => {}

	const set = (open) => {
		about.hidden = !open
		toggle.setAttribute('aria-expanded', String(open))
		if (text) text.textContent = open ? toggle.dataset.textHide : toggle.dataset.textShow
	}
	toggle.hidden = false
	toggle.addEventListener('click', () => set(about.hidden), { signal: controller.signal })

	return () => {
		controller.abort()
		set(true)
		toggle.hidden = true
	}
}
