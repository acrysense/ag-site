// Мобильный: строки фильтров прокручиваются вбок — выбранная «таблетка» должна быть видна.
// Крутим только саму строку (не scrollIntoView — он дёрнул бы страницу по вертикали).
export default function init(root) {
	for (const list of root.querySelectorAll('.news-filters__list')) {
		const current = list.querySelector('[aria-current]')?.closest('li')
		if (!current || list.scrollWidth <= list.clientWidth) continue
		const listLeft = list.getBoundingClientRect().left
		const itemLeft = current.getBoundingClientRect().left - listLeft + list.scrollLeft
		list.scrollLeft = Math.max(0, itemLeft - (list.clientWidth - current.offsetWidth) / 2)
	}
	return () => {}
}
