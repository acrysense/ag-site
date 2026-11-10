import { filterPanel } from '@/utils/filter-panel'

// Папки документов (и дерево «Структура» холдинга): шевроны раскрывают подпапки (hidden у
// вложенного списка), «Свернуть всё» (data-folders-collapse-all) сворачивает все. Состояние не
// запоминается: ветку текущей папки раскрывает бэк (expanded). До 1024 — панель на весь экран:
// открывает [data-documents-folders-open="<id>"] (поле «Папка: …» в списке), закрывают × и Esc
// (utils/filter-panel.js, без формы).
export default function init(root) {
	const controller = new AbortController()
	const disposePanel = filterPanel(root, {
		open: 'data-documents-folders-open',
		close: '[data-documents-folders-close]',
	})

	root.addEventListener(
		'click',
		(event) => {
			// «Свернуть всё» — все ветки
			if (event.target.closest('[data-folders-collapse-all]')) {
				root.querySelectorAll('[data-folders-expand][aria-expanded="true"]').forEach(
					(button) => {
						button.setAttribute('aria-expanded', 'false')
						const list = root.querySelector(
							`#${CSS.escape(button.getAttribute('aria-controls'))}`
						)
						if (list) list.hidden = true
					}
				)
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

	return () => {
		controller.abort()
		disposePanel()
	}
}
