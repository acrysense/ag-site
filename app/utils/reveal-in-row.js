// Строка с прокруткой вбок (фильтры новостей, вкладки поиска на мобильном): выбранный пункт —
// в видимой части, по центру. Крутится только сама строка: scrollIntoView дёрнул бы страницу
// по вертикали.
export function revealInRow(row, item) {
	if (!row || !item || row.scrollWidth <= row.clientWidth) return
	const rowLeft = row.getBoundingClientRect().left
	const itemLeft = item.getBoundingClientRect().left - rowLeft + row.scrollLeft
	row.scrollLeft = Math.max(0, itemLeft - (row.clientWidth - item.offsetWidth) / 2)
}
