import { filterMore, filterPanel, plural } from '@/utils/filter-panel'

// Фильтры вакансий: сайдбар и панель на весь экран, «Показать ещё N» — utils/filter-panel.js
export default function init(root) {
	const disposeMore = filterMore(root, '.vacancy-filters__group')
	const disposePanel = filterPanel(root, {
		open: 'data-vacancy-filters-open',
		close: '[data-vacancy-filters-close]',
		count: '[data-vacancy-filters-count]',
		countUrl: root.dataset.countUrl,
		countText: (n) => `Показать ${n} ${plural(n, 'вакансию', 'вакансии', 'вакансий')}`,
	})

	return () => {
		disposeMore()
		disposePanel()
	}
}
