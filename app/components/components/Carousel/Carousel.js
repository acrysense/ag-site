// Карусель на нативной прокрутке с привязкой к кадрам (scroll-snap): свайп и тачпад работают
// сами, JS — стрелки, точки, номер текущего кадра и видео в кадрах. Без сторонних библиотек.
// Разметка: [data-carousel-track] с кадрами, [data-carousel-prev], [data-carousel-next],
// [data-carousel-dots] (точки создаются здесь). data-carousel-loop — после последнего к первому.
// Кадр может быть уже дорожки (несколько карточек на экране): стрелки листают по экрану.
// Всё поместилось без прокрутки — стрелок и точек нет (класс is-single).
// data-carousel-autoplay="5" — автолистание раз в 5 с, по кругу; отсчёт заново после любой
// прокрутки. Стоит, пока на карусели мышь (или палец) и фокус с клавиатуры, пока её не видно
// (за экраном, вкладка в фоне) и при «уменьшить движение».
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const track = root.querySelector('[data-carousel-track]')
	const slides = track ? [...track.children] : []
	const dots = root.querySelector('[data-carousel-dots]')
	const loop = root.hasAttribute('data-carousel-loop')
	const autoplay = Number(root.dataset.carouselAutoplay) * 1000 || 0
	let frame = 0
	let timer = 0
	let hovered = false
	let visible = false

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

	// Шаг — расстояние между соседними кадрами с промежутком; на экране perView кадров
	const step = () => slides[1].offsetLeft - slides[0].offsetLeft || track.clientWidth || 1
	const perView = () =>
		Math.max(1, Math.round((track.clientWidth + step() - slides[0].offsetWidth) / step()))
	const current = () => Math.round(track.scrollLeft / step())

	const go = (index) => {
		const count = slides.length
		const target = loop ? (index + count) % count : Math.min(Math.max(index, 0), count - 1)
		scrollToSlide(target)
	}

	// Стрелки: на экран вперёд или назад; у края с loop (и при автолистании) — к другому краю
	const page = (direction, wrap = loop) => {
		const index = current()
		const size = perView()
		const last = Math.max(0, slides.length - size)
		let target = index + direction * size
		if (target > last) target = index >= last && wrap ? 0 : last
		if (target < 0) target = index <= 0 && wrap ? last : 0
		scrollToSlide(target)
	}

	const scrollToSlide = (target) => {
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

	const schedule = () => {
		clearTimeout(timer)
		const active = document.activeElement
		const focused = root.contains(active) && active.matches(':focus-visible')
		if (!autoplay || hovered || focused || !visible || document.hidden) return
		if (reducedMotion.matches || root.classList.contains('is-single')) return
		timer = setTimeout(() => {
			page(1, true)
			schedule()
		}, autoplay)
	}

	root.querySelector('[data-carousel-prev]')?.addEventListener('click', () => page(-1), {
		signal,
	})
	root.querySelector('[data-carousel-next]')?.addEventListener('click', () => page(1), { signal })

	// Листать нечего (всё поместилось или блок скрыт) — стрелки и точки прячутся
	const observer = new ResizeObserver(() => {
		root.classList.toggle('is-single', track.scrollWidth <= track.clientWidth + 1)
		schedule()
	})
	observer.observe(track)

	const viewport = new IntersectionObserver(
		([entry]) => {
			visible = entry.isIntersecting
			schedule()
		},
		{ threshold: 0.5 }
	)
	if (autoplay) {
		viewport.observe(root)
		const hover = (state) => () => {
			hovered = state
			schedule()
		}
		root.addEventListener('pointerenter', hover(true), { signal })
		root.addEventListener('pointerleave', hover(false), { signal })
		root.addEventListener('focusin', schedule, { signal })
		root.addEventListener('focusout', schedule, { signal })
		document.addEventListener('visibilitychange', schedule, { signal })
		reducedMotion.addEventListener('change', schedule, { signal })
	}

	track.addEventListener(
		'scroll',
		() => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(render)
			schedule()
		},
		{ signal }
	)

	render()

	return () => {
		controller.abort()
		observer.disconnect()
		viewport.disconnect()
		cancelAnimationFrame(frame)
		clearTimeout(timer)
		dots?.replaceChildren()
		videos.forEach((video) => video?.pause())
	}
}
