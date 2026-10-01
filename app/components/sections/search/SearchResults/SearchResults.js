import { announce } from '@/utils/announce'
import { skeleton, skeletonLines } from '@/utils/skeleton'

// «Показать ещё» (до 1024): следующая страница выдачи догружается без перехода — из её HTML
// берутся пункты [data-search-items] и новая ссылка «Показать ещё» (её нет — страниц больше нет).
// Бэку отдельный API не нужен: та же страница с ?page=N. Ошибка — обычный переход по ссылке.
// Пока грузится — под списком заготовки пунктов (components/Skeleton).
const resultSkeleton = () => {
	const li = document.createElement('li')
	li.setAttribute('aria-hidden', 'true')
	li.setAttribute('data-search-skeleton', '')
	const row = document.createElement('div')
	row.className = 'search-result'
	row.append(skeleton('media', 'search-result__preview'), skeletonLines(3, 'search-result__text'))
	li.append(row)
	return li
}

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	let request = null

	root.addEventListener(
		'click',
		async (event) => {
			const link = event.target.closest('[data-search-more]')
			if (!link || event.ctrlKey || event.metaKey || event.shiftKey) return
			event.preventDefault()
			if (request) return
			const list = root.querySelector('[data-search-items]')
			const own = new AbortController()
			request = own
			link.classList.add('is-loading')
			link.setAttribute('aria-busy', 'true')
			const placeholders = [resultSkeleton(), resultSkeleton()]
			list?.append(...placeholders)
			try {
				const response = await fetch(link.href, {
					signal: own.signal,
					credentials: 'same-origin',
					headers: { Accept: 'text/html' },
				})
				if (!response.ok) throw new Error(`HTTP ${response.status}`)
				const html = await response.text()
				if (signal.aborted) return
				const page = new DOMParser().parseFromString(html, 'text/html')
				const items = [...(page.querySelector('[data-search-items]')?.children || [])]
				const first = items[0]
				placeholders.forEach((el) => el.remove())
				list?.append(...items.map((item) => document.importNode(item, true)))
				const next = page.querySelector('[data-search-more]')
				if (next) link.href = next.getAttribute('href')
				else link.remove()
				announce(`Загружено ещё ${items.length}`)
				// Фокус — на первый новый пункт, чтобы продолжить чтение с него
				if (first)
					list?.children[list.children.length - items.length]?.querySelector('a')?.focus()
			} catch (error) {
				if (!signal.aborted && !own.signal.aborted) window.location.assign(link.href)
			} finally {
				placeholders.forEach((el) => el.remove())
				if (request === own) request = null
				link.classList.remove('is-loading')
				link.removeAttribute('aria-busy')
			}
		},
		{ signal }
	)

	return () => {
		controller.abort()
		request?.abort()
	}
}
