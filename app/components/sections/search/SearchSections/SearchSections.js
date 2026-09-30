import { revealInRow } from '@/utils/reveal-in-row'

// Лента вкладок (мобильный): текущий раздел — в видимой части строки
export default function init(root) {
	const row = root.querySelector('.search-sections__list')
	revealInRow(row, row?.querySelector('[aria-current]')?.closest('li'))
	return () => {}
}
