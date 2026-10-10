import { createPhotoViewer } from '@/components/components/PhotoViewer/PhotoViewer'

// Выпуск журнала: страницы — лента с привязкой (свайп и колесо работают сами), здесь — стрелки,
// «N / M», миниатюры (текущая видна в ленте), ←/→ с клавиатуры и «На весь экран» — PhotoViewer со
// страницами выпуска: «Страница N из M», «Нравится» (одна отметка на выпуск — та же, что на
// странице), «Скачать PDF». После закрытия лента стоит на той странице, где закрыли.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const track = root.querySelector('[data-journal-track]')
	if (!track) return () => {}
	const pages = [...track.children]
	const links = pages.map((page) => page.querySelector('a'))
	const total = pages.length
	const prev = root.querySelector('[data-journal-prev]')
	const next = root.querySelector('[data-journal-next]')
	const counter = root.querySelector('[data-journal-counter]')
	const thumbsList = root.querySelector('[data-journal-thumbs]')
	const thumbs = [...root.querySelectorAll('[data-journal-thumb]')]
	const pageLike = root.querySelector('.journal-issue__actions .like-button')
	let frame = 0
	let shown = -1

	const current = () =>
		Math.min(total - 1, Math.max(0, Math.round(track.scrollLeft / (track.clientWidth || 1))))

	const go = (index, smooth = true) => {
		const target = Math.min(total - 1, Math.max(0, index))
		track.scrollTo({
			left: target * track.clientWidth,
			behavior: smooth && !reducedMotion.matches ? 'smooth' : 'auto',
		})
	}

	const render = () => {
		frame = 0
		const index = current()
		if (index === shown) return
		shown = index
		if (counter) counter.textContent = `${index + 1} / ${total}`
		if (prev) prev.disabled = index === 0
		if (next) next.disabled = index === total - 1
		thumbs.forEach((thumb, i) => {
			if (i === index) thumb.setAttribute('aria-current', 'true')
			else thumb.removeAttribute('aria-current')
		})
		// Текущая миниатюра — в середине ленты, если лента шире экрана
		const thumb = thumbs[index]?.parentElement
		if (thumbsList && thumb && thumbsList.scrollWidth > thumbsList.clientWidth) {
			thumbsList.scrollTo({
				left: thumb.offsetLeft - thumbsList.offsetLeft - (thumbsList.clientWidth - thumb.offsetWidth) / 2,
				behavior: reducedMotion.matches ? 'auto' : 'smooth',
			})
		}
	}

	track.addEventListener(
		'scroll',
		() => {
			if (!frame) frame = requestAnimationFrame(render)
		},
		{ passive: true, signal }
	)
	prev?.addEventListener('click', () => go(current() - 1), { signal })
	next?.addEventListener('click', () => go(current() + 1), { signal })
	thumbs.forEach((thumb, index) => thumb.addEventListener('click', () => go(index), { signal }))
	root.addEventListener(
		'keydown',
		(event) => {
			if (!track.contains(event.target)) return
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
			event.preventDefault()
			go(current() + (event.key === 'ArrowRight' ? 1 : -1))
		},
		{ signal }
	)
	// Ширина поменялась — лента остаётся на той же странице
	const resize = new ResizeObserver(() => {
		if (shown >= 0) go(shown, false)
	})
	resize.observe(track)

	// Отметка «Нравится» на странице → данные просмотра (одна на весь выпуск)
	const likeState = () => ({
		liked: pageLike?.getAttribute('aria-pressed') === 'true',
		likes: Number(pageLike?.querySelector('[data-like-count]')?.textContent) || 0,
		likeUrl: pageLike?.dataset.likeUrl,
	})

	const items = links.map((link) => {
		const img = link.querySelector('img')
		return {
			src: link.href,
			srcset: img?.getAttribute('srcset') || undefined,
			width: Number(link.dataset.width) || 1536,
			height: Number(link.dataset.height) || 864,
			thumb: link.dataset.thumb || img?.currentSrc || img?.src,
			alt: img?.alt || '',
			download: root.dataset.download,
			...likeState(),
		}
	})

	const viewer = createPhotoViewer({
		title: root.dataset.title || '',
		items,
		withLikes: Boolean(pageLike),
		className: 'photo-viewer--pages',
		thumbs: { desktop: { width: 84, gap: 8 }, mobile: { width: 64, gap: 6 } },
		labels: {
			counter: (n, count) => `Страница ${n} из ${count}`,
			item: (n) => `Страница ${n}`,
			prev: 'Предыдущая страница',
			next: 'Следующая страница',
			download: 'Скачать PDF',
			dialog: root.dataset.title ? `Выпуск «${root.dataset.title}»` : 'Выпуск',
			error: 'Не удалось загрузить страницу',
		},
		// В просмотре отметили — та же отметка у всех страниц и на кнопке под выпуском
		onLike: (_, liked, likes) => {
			items.forEach((item) => Object.assign(item, { liked, likes }))
			if (!pageLike) return
			pageLike.setAttribute('aria-pressed', String(liked))
			const count = pageLike.querySelector('[data-like-count]')
			if (count) {
				count.textContent = String(likes)
				count.hidden = likes <= 0
			}
		},
		onClose: (index) => go(index, false),
	})

	const likeObserver = pageLike
		? new MutationObserver(() => {
				const state = likeState()
				items.forEach((item, index) => viewer.update(index, state))
			})
		: null
	likeObserver?.observe(pageLike, { attributes: true, attributeFilter: ['aria-pressed'] })

	links.forEach((link, index) =>
		link.addEventListener(
			'click',
			(event) => {
				event.preventDefault()
				viewer.open(index)
			},
			{ signal }
		)
	)
	root.querySelector('[data-journal-full]')?.addEventListener(
		'click',
		() => viewer.open(current()),
		{ signal }
	)

	render()

	return () => {
		controller.abort()
		cancelAnimationFrame(frame)
		resize.disconnect()
		likeObserver?.disconnect()
		viewer.destroy()
	}
}
