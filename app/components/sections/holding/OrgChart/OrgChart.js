// Оргсхема: узел с подчинёнными (кнопка data-org-toggle, aria-controls — id панели) раскрывает
// панель под рядом и сворачивает другую раскрытую; «Свернуть» (data-org-collapse) — сворачивает и
// возвращает фокус на узел. Раскрытая панель подводится в видимую часть экрана. У одной панели
// может быть несколько кнопок (узел и «В подчинении · N» до 1024) — состояние у них общее.
// До 1024 «В подчинении · N» под одиночным узлом (data-org-sub) сворачивает его поддерево.
// Без JS панели остаются как вывел бэк (open — раскрыта), поддеревья открыты.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const toggles = [...root.querySelectorAll('[data-org-toggle]')]
	const target = (button) =>
		root.querySelector(`#${CSS.escape(button.getAttribute('aria-controls'))}`)
	const twins = (id) => toggles.filter((t) => t.getAttribute('aria-controls') === id)

	const set = (id, open) => {
		const panel = root.querySelector(`#${CSS.escape(id)}`)
		if (!panel) return
		panel.hidden = !open
		twins(id).forEach((t) => t.setAttribute('aria-expanded', String(open)))
	}

	toggles.forEach((toggle) =>
		toggle.addEventListener(
			'click',
			() => {
				const id = toggle.getAttribute('aria-controls')
				const open = toggle.getAttribute('aria-expanded') !== 'true'
				new Set(toggles.map((t) => t.getAttribute('aria-controls'))).forEach(
					(other) => other !== id && set(other, false)
				)
				set(id, open)
				if (open)
					target(toggle)?.scrollIntoView({
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
				const id = button.getAttribute('aria-controls')
				const toggle = twins(id).find((t) => t.checkVisibility?.() ?? t.offsetParent)
				set(id, false)
				toggle?.focus()
			},
			{ signal }
		)
	)

	root.querySelectorAll('[data-org-sub]').forEach((button) =>
		button.addEventListener(
			'click',
			() => {
				const sub = target(button)
				if (!sub) return
				const open = button.getAttribute('aria-expanded') !== 'true'
				sub.hidden = !open
				button.setAttribute('aria-expanded', String(open))
			},
			{ signal }
		)
	)

	return () => controller.abort()
}
