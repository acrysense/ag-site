// Текст из визуального редактора Битрикса (.content). Админ вставляет обычный HTML — обёртки
// добавляем сами: таблицы — в блок с прокруткой вбок (на телефоне не распирают страницу),
// в заголовок раскрывающегося блока (<details><summary>) — стрелку из спрайта.
import { createIcon } from '@/utils/icon'

const chevron = () => createIcon('chevron-down', 'content__summary-icon')

export default function init(root) {
	const added = []

	for (const table of root.querySelectorAll('table')) {
		if (table.parentElement?.classList.contains('content__table')) continue
		const wrap = document.createElement('div')
		wrap.className = 'content__table'
		wrap.tabIndex = 0
		wrap.setAttribute('role', 'region')
		wrap.setAttribute('aria-label', table.caption?.textContent?.trim() || 'Таблица')
		table.before(wrap)
		wrap.append(table)
		added.push(() => {
			wrap.before(table)
			wrap.remove()
		})
	}

	for (const summary of root.querySelectorAll('details > summary')) {
		if (summary.querySelector('.content__summary-icon')) continue
		const icon = chevron()
		summary.append(icon)
		added.push(() => icon.remove())
	}

	return () => added.forEach((undo) => undo())
}
