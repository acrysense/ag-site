// Иконка из SVG-спрайта для разметки, которую создаёт JS. Спрайт — отдельный файл
// (assets/icons/sprite.svg), путь к нему — в <html data-icons="…/sprite.svg">: его выводит шаблон
// сайта, как и <use href="…/sprite.svg#icon-…"> в разметке блоков.
const SVG = 'http://www.w3.org/2000/svg'

export const iconHref = (name) => `${document.documentElement.dataset.icons || ''}#icon-${name}`

export function createIcon(name, className = '') {
	const svg = document.createElementNS(SVG, 'svg')
	svg.setAttribute('class', `icon${className ? ` ${className}` : ''}`)
	svg.setAttribute('aria-hidden', 'true')
	svg.setAttribute('focusable', 'false')
	const use = document.createElementNS(SVG, 'use')
	use.setAttribute('href', iconHref(name))
	svg.append(use)
	return svg
}
