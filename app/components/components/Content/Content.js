// Текст из визуального редактора Битрикса (.content). Админ вставляет обычный HTML — обёртки
// добавляем сами: таблицы — в блок с прокруткой вбок (на телефоне не распирают страницу),
// в заголовок раскрывающегося блока (<details><summary>) — стрелку из спрайта.
const SVG = 'http://www.w3.org/2000/svg'

const chevron = () => {
	const svg = document.createElementNS(SVG, 'svg')
	svg.setAttribute('class', 'icon content__summary-icon')
	svg.setAttribute('aria-hidden', 'true')
	svg.setAttribute('focusable', 'false')
	const use = document.createElementNS(SVG, 'use')
	use.setAttribute('href', '#icon-chevron-down')
	svg.append(use)
	return svg
}

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
