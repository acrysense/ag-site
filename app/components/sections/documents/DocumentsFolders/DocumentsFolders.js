// Папки документов: до 1024 плашка «Папки» раскрывает дерево (класс is-open), шевроны
// раскрывают подпапки (hidden у вложенного списка). Состояние не запоминается: ветку текущей
// папки раскрывает бэк (expanded).
export default function init(root) {
	const controller = new AbortController()

	root.addEventListener(
		'click',
		(event) => {
			const toggle = event.target.closest('[data-folders-toggle]')
			if (toggle) {
				const open = toggle.getAttribute('aria-expanded') !== 'true'
				toggle.setAttribute('aria-expanded', String(open))
				root.classList.toggle('is-open', open)
				return
			}
			const expand = event.target.closest('[data-folders-expand]')
			if (!expand) return
			const list = root.querySelector(`#${CSS.escape(expand.getAttribute('aria-controls'))}`)
			const open = expand.getAttribute('aria-expanded') !== 'true'
			expand.setAttribute('aria-expanded', String(open))
			if (list) list.hidden = !open
		},
		{ signal: controller.signal }
	)

	return () => controller.abort()
}
