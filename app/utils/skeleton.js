// Скелетон загрузки из JS — те же классы, что у components/Skeleton (вид — там же).
// skeleton('field') — одна заготовка; skeletonLines(3) — абзац из строк.
export function skeleton(variant = 'text', className = '') {
	const el = document.createElement('span')
	el.className = `skeleton skeleton--${variant}${className ? ` ${className}` : ''}`
	el.setAttribute('aria-hidden', 'true')
	return el
}

export function skeletonLines(count = 3, className = '') {
	const el = document.createElement('span')
	el.className = `skeleton-lines${className ? ` ${className}` : ''}`
	el.setAttribute('aria-hidden', 'true')
	for (let i = 0; i < count; i++) el.append(skeleton('text'))
	return el
}
