// Календарь дней рождения: до 1024 дни раньше текущей недели (класс is-earlier, ставит бэк)
// свёрнуты, список начинается с понедельника. Кнопка «Показать с 1 …»
// раскрывает их. Без скрипта свёрнутого нет — видны все дни.
export default function init(root) {
	const button = root.querySelector('[data-birthday-earlier]')
	const earlier = root.querySelectorAll(
		'.birthday-calendar__day.is-earlier:not(.is-empty, .is-other-month)'
	)
	if (!button || !earlier.length) return

	const controller = new AbortController()
	root.classList.add('is-collapsed')
	button.hidden = false
	button.addEventListener(
		'click',
		() => {
			root.classList.remove('is-collapsed')
			button.hidden = true
			// Кнопка исчезла — фокус на первый раскрытый день, чтобы продолжить с него
			earlier[0].tabIndex = -1
			earlier[0].focus({ preventScroll: true })
			earlier[0].scrollIntoView({ block: 'start', behavior: 'smooth' })
		},
		{ signal: controller.signal }
	)

	return () => {
		controller.abort()
		root.classList.remove('is-collapsed')
		button.hidden = true
	}
}
