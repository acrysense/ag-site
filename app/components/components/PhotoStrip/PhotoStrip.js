import { createPhotoViewer } from '@/components/components/PhotoViewer/PhotoViewer'

// Лента фото: стрелки листают на 80% ширины (у края прячутся), фото открывается в просмотре на
// весь экран (PhotoViewer без «Нравится»). Данные просмотра — из ссылок разметки: адрес большого
// фото, data-width / data-height, миниатюра и alt.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const list = root.querySelector('[data-photo-strip-list]')
	const prev = root.querySelector('[data-photo-strip-prev]')
	const next = root.querySelector('[data-photo-strip-next]')
	if (!list) return () => {}

	const links = [...list.querySelectorAll('.photo-strip__link')]
	const items = links.map((link) => {
		const img = link.querySelector('img')
		return {
			src: link.href,
			width: Number(link.dataset.width) || img?.naturalWidth || 1600,
			height: Number(link.dataset.height) || img?.naturalHeight || 1067,
			thumb: img?.currentSrc || img?.src,
			alt: img?.alt || '',
		}
	})

	let viewer = null
	links.forEach((link, index) =>
		link.addEventListener(
			'click',
			(event) => {
				event.preventDefault()
				viewer ??= createPhotoViewer({
					title: root.dataset.title || '',
					items,
					withLikes: false,
				})
				viewer.open(index)
			},
			{ signal }
		)
	)

	// Стрелки: у начала ленты нет «назад», у конца — «вперёд»; не листается — обеих нет
	let frame = 0
	const update = () => {
		frame = 0
		const max = list.scrollWidth - list.clientWidth
		if (prev) prev.hidden = list.scrollLeft <= 1
		if (next) next.hidden = list.scrollLeft >= max - 1
	}
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(update)
	}
	const step = (dir) =>
		list.scrollBy({
			left: dir * list.clientWidth * 0.8,
			behavior: reducedMotion.matches ? 'auto' : 'smooth',
		})
	prev?.addEventListener('click', () => step(-1), { signal })
	next?.addEventListener('click', () => step(1), { signal })
	list.addEventListener('scroll', schedule, { passive: true, signal })
	// Ширина ленты меняется с окном; длина — когда догружаются фото
	const resize = new ResizeObserver(schedule)
	resize.observe(list)
	list.querySelectorAll('img').forEach((img) =>
		img.addEventListener('load', schedule, { signal })
	)
	update()

	return () => {
		controller.abort()
		resize.disconnect()
		cancelAnimationFrame(frame)
		viewer?.destroy()
	}
}
