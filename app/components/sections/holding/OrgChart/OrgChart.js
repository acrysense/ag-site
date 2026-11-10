// Оргсхема: узел с подчинёнными (кнопка data-org-toggle, aria-controls — id панели) раскрывает
// панель под рядом и сворачивает другую раскрытую; «Свернуть» (data-org-collapse) — сворачивает и
// возвращает фокус на узел. Раскрытая панель подводится в видимую часть экрана. Без JS панели
// остаются как вывел бэк (open — раскрыта).
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const toggles = [...root.querySelectorAll('[data-org-toggle]')]
	const panelOf = (toggle) =>
		root.querySelector(`#${CSS.escape(toggle.getAttribute('aria-controls'))}`)

	const set = (toggle, open) => {
		const panel = panelOf(toggle)
		if (!panel) return
		panel.hidden = !open
		toggle.setAttribute('aria-expanded', String(open))
	}

	toggles.forEach((toggle) =>
		toggle.addEventListener(
			'click',
			() => {
				const open = toggle.getAttribute('aria-expanded') !== 'true'
				toggles.forEach((other) => other !== toggle && set(other, false))
				set(toggle, open)
				if (open)
					panelOf(toggle)?.scrollIntoView({
						block: 'nearest',
						behavior: reduceMotion.matches ? 'auto' : 'smooth',
					})
			},
			{ signal }
		)
	)

	root.querySelectorAll('[data-org-collapse]').forEach((button) =>
		button.addEventListener(
			'click',
			() => {
				const toggle = toggles.find(
					(t) => t.getAttribute('aria-controls') === button.getAttribute('aria-controls')
				)
				if (!toggle) return
				set(toggle, false)
				toggle.focus()
			},
			{ signal }
		)
	)

	return () => controller.abort()
}
