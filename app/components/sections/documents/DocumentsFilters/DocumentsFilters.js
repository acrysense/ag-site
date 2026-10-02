import { filterMore, filterPanel, plural } from '@/utils/filter-panel'

// Фильтры документов: сайдбар и панель на весь экран, «Показать ещё N» — utils/filter-panel.js
export default function init(root) {
	const disposeMore = filterMore(root, '.documents-filters__group')
	const disposePanel = filterPanel(root, {
		open: 'data-documents-filters-open',
		close: '[data-documents-filters-close]',
		count: '[data-documents-filters-count]',
		countUrl: root.dataset.countUrl,
		countText: (n) => `Показать ${n} ${plural(n, 'документ', 'документа', 'документов')}`,
	})

	return () => {
		disposeMore()
		disposePanel()
	}
}
