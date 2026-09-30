// Вкладки по WAI-ARIA: [role=tab] с aria-controls на панель. Клик, стрелки влево и вправо,
// Home и End переключают вкладку (фокус идёт за выбором). Неактивные панели — hidden.
export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const tabs = [...root.querySelectorAll('[role="tab"]')]

	const select = (tab, focus = false) => {
		tabs.forEach((item) => {
			const selected = item === tab
			item.setAttribute('aria-selected', String(selected))
			item.tabIndex = selected ? 0 : -1
			const panel = document.getElementById(item.getAttribute('aria-controls'))
			if (panel) panel.hidden = !selected
		})
		if (focus) tab.focus()
	}

	tabs.forEach((tab) => tab.addEventListener('click', () => select(tab), { signal }))

	root.addEventListener(
		'keydown',
		(event) => {
			const index = tabs.indexOf(document.activeElement)
			if (index < 0) return
			const last = tabs.length - 1
			const next = {
				ArrowRight: index === last ? 0 : index + 1,
				ArrowLeft: index === 0 ? last : index - 1,
				Home: 0,
				End: last,
			}[event.key]
			if (next === undefined) return
			event.preventDefault()
			select(tabs[next], true)
		},
		{ signal }
	)

	return () => controller.abort()
}
