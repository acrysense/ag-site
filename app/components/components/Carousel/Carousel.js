// Карусель на нативной прокрутке с привязкой к кадрам (scroll-snap): свайп и тачпад работают
// сами, JS — стрелки, точки, номер текущего кадра и видео в кадрах. Без сторонних библиотек.
// Разметка: [data-carousel-track] с кадрами, [data-carousel-prev], [data-carousel-next],
// [data-carousel-dots] (точки создаются здесь). data-carousel-loop — после последнего к первому.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const track = root.querySelector('[data-carousel-track]')
	const slides = track ? [...track.children] : []
	const dots = root.querySelector('[data-carousel-dots]')
	const loop = root.hasAttribute('data-carousel-loop')
	let frame = 0

	// Один кадр — ни стрелок, ни точек
	root.classList.toggle('is-single', slides.length < 2)
	if (slides.length < 2) {
		const video = slides[0]?.querySelector('video')
		if (video && !reducedMotion.matches) video.play().catch(() => {})
		return () => {
			controller.abort()
			video?.pause()
		}
	}

	const current = () => Math.round(track.scrollLeft / track.clientWidth)

	const go = (index) => {
		const count = slides.length
		const target = loop ? (index + count) % count : Math.min(Math.max(index, 0), count - 1)
		track.scrollTo({
			left: slides[target].offsetLeft - slides[0].offsetLeft,
			behavior: reducedMotion.matches ? 'auto' : 'smooth',
		})
	}

	const dotButtons = dots
		? slides.map((_, index) => {
				const button = document.createElement('button')
				button.type = 'button'
				button.className = 'carousel__dot'
				button.setAttribute('aria-label', `Слайд ${index + 1} из ${slides.length}`)
				button.addEventListener('click', () => go(index), { signal })
				dots.append(button)
				return button
			})
		: []

	// Видео в кадрах: играет только видимое и только если не просили уменьшить движение
	const videos = slides.map((slide) => slide.querySelector('video'))

	const render = () => {
		const index = current()
		dotButtons.forEach((button, i) => button.setAttribute('aria-current', String(i === index)))
		videos.forEach((video, i) => {
			if (!video) return
			if (i === index && !reducedMotion.matches) video.play().catch(() => {})
			else video.pause()
		})
	}

	root.querySelector('[data-carousel-prev]')?.addEventListener('click', () => go(current() - 1), {
		signal,
	})
	root.querySelector('[data-carousel-next]')?.addEventListener('click', () => go(current() + 1), {
		signal,
	})

	track.addEventListener(
		'scroll',
		() => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(render)
		},
		{ signal }
	)

	render()

	return () => {
		controller.abort()
		cancelAnimationFrame(frame)
		dots?.replaceChildren()
		videos.forEach((video) => video?.pause())
	}
}
