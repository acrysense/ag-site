import { filterPanel, plural } from '@/utils/filter-panel'

// Фильтры вакансий: сайдбар и панель на весь экран — utils/filter-panel.js. Здесь — «Показать
// ещё N»: открывает спрятанные пункты группы и ставит фокус на первый из них. Выбранный пункт
// среди спрятанных — группа открыта сразу.
export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller

	const reveal = (group, focus = false) => {
		const extras = [...group.querySelectorAll('[data-filter-extra]')]
		extras.forEach((item) => (item.hidden = false))
		group.querySelector('[data-filter-more]')?.remove()
		if (focus) extras[0]?.querySelector('input')?.focus()
	}

	root.querySelectorAll('.vacancy-filters__group').forEach((group) => {
		if (group.querySelector('[data-filter-extra] input:checked')) reveal(group)
	})
	root.addEventListener(
		'click',
		(event) => {
			const more = event.target.closest('[data-filter-more]')
			if (more) reveal(more.closest('.vacancy-filters__group'), true)
		},
		{ signal }
	)

	const dispose = filterPanel(root, {
		open: 'data-vacancy-filters-open',
		close: '[data-vacancy-filters-close]',
		count: '[data-vacancy-filters-count]',
		countUrl: root.dataset.countUrl,
		countText: (n) => `Показать ${n} ${plural(n, 'вакансию', 'вакансии', 'вакансий')}`,
	})

	return () => {
		controller.abort()
		dispose()
	}
}
