import { filterPanel, plural } from '@/utils/filter-panel'

// Фильтры страницы результатов. Блок внутри GET-формы поиска; поведение сайдбара и панели —
// utils/filter-panel.js
export default function init(root) {
	return filterPanel(root, {
		open: 'data-search-filters-open',
		close: '[data-search-filters-close]',
		count: '[data-search-count]',
		countUrl: root.dataset.searchCountUrl,
		countText: (n) => `Показать ${n} ${plural(n, 'результат', 'результата', 'результатов')}`,
	})
}
