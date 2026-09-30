import { revealInRow } from '@/utils/reveal-in-row'

// Мобильный: строки фильтров прокручиваются вбок — выбранная «таблетка» должна быть видна
export default function init(root) {
	for (const list of root.querySelectorAll('.news-filters__list'))
		revealInRow(list, list.querySelector('[aria-current]')?.closest('li'))
	return () => {}
}
