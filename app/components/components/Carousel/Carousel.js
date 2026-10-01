// Карусель на нативной прокрутке с привязкой к кадрам (scroll-snap): свайп и тачпад работают
// сами, JS — стрелки, точки, номер текущего кадра и видео в кадрах. Без сторонних библиотек.
// Разметка: [data-carousel-track] с кадрами, [data-carousel-prev], [data-carousel-next],
// [data-carousel-dots] (точки создаются здесь). data-carousel-loop — после последнего к первому.
// Кадр может быть уже дорожки (несколько карточек на экране): стрелки листают по экрану.
// Всё поместилось без прокрутки — стрелок и точек нет (класс is-single).
// data-carousel-autoplay="5" — автолистание раз в 5 с, по кругу; отсчёт заново после любой
// прокрутки. Встаёт на паузу, пока на карусели мышь (или палец) и фокус с клавиатуры, пока её не
// видно (за экраном, вкладка в фоне); при «уменьшить движение» выключено. Активная точка-полоска
// заполняется за время до следующего кадра и замирает на паузе (класс has-progress).
// Кадр с видео держится, пока идёт ролик, но не дольше VIDEO_MAX; ролик короче интервала крутится
// по кругу (атрибут loop), пока интервал не пройдёт.
const VIDEO_MAX = 15000
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
	let total = autoplay
	let remaining = autoplay
	let startedAt = 0
	let progress = null
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
				if (autoplay)
					button.append(
						Object.assign(document.createElement('span'), {
							className: 'carousel__dot-fill',
						})
					)
				dots.append(button)
				return button
			})
		: []

	// Видео в кадрах: играет только видимое и только если не просили уменьшить движение
	const videos = slides.map((slide) => slide.querySelector('video'))

	let shown = -1
	const render = () => {
		const index = current()
		dotButtons.forEach((button, i) => button.setAttribute('aria-current', String(i === index)))
		videos.forEach((video, i) => {
			if (!video) return
			if (i !== index) return video.pause()
			// Ролик на кадре, куда только что пришли, — с начала: отсчёт кадра идёт по его длине
			if (index !== shown) video.currentTime = 0
			if (!reducedMotion.matches) video.play().catch(() => {})
		})
		shown = index
	}

	// Время кадра: интервал или длина ролика (не короче интервала и не дольше VIDEO_MAX).
	// Длина неизвестна, пока не загрузились метаданные, — до тех пор интервал
	const duration = () => {
		const length = videos[current()]?.duration * 1000
		return Number.isFinite(length) && length > 0
			? Math.min(Math.max(length, autoplay), Math.max(VIDEO_MAX, autoplay))
			: autoplay
	}

	// Заполнение активной точки повторяет таймер: тот же остаток, та же пауза
	const syncProgress = () => {
		const fill = dotButtons[current()]?.firstElementChild
		if (progress?.effect.target !== fill) {
			progress?.cancel()
			progress = fill?.animate(
				[{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }],
				{ duration: total, fill: 'both' }
			)
		}
		if (!progress) return
		if (progress.effect.getTiming().duration !== total)
			progress.effect.updateTiming({ duration: total })
		progress.currentTime = total - remaining
		if (timer) progress.play()
		else progress.pause()
	}

	// Пауза сохраняет остаток времени, продолжение досчитывает его
	const schedule = () => {
		if (!autoplay) return
		const active = document.activeElement
		const focused = root.contains(active) && active.matches(':focus-visible')
		const enabled = !reducedMotion.matches && !root.classList.contains('is-single')
		const run = enabled && !hovered && !focused && visible && !document.hidden
		root.classList.toggle('has-progress', enabled)
		if (!run && timer) {
			clearTimeout(timer)
			timer = 0
			remaining -= performance.now() - startedAt
		}
		if (run && !timer) {
			startedAt = performance.now()
			timer = setTimeout(() => {
				timer = 0
				page(1, true)
				restart()
			}, remaining)
		}
		syncProgress()
	}

	// Новый кадр (или прокрутка рукой) — отсчёт с начала
	const restart = () => {
		clearTimeout(timer)
		timer = 0
		total = duration()
		remaining = total
		schedule()
	}

	// Метаданные ролика на текущем кадре пришли — отсчёт кадра по его длине
	videos.forEach((video, i) => {
		video?.addEventListener(
			'loadedmetadata',
			() => {
				if (autoplay && i === current()) restart()
			},
			{ signal }
		)
	})

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
			frame = requestAnimationFrame(() => {
				render()
				restart()
			})
		},
		{ signal }
	)

	render()
	if (autoplay) restart()

	return () => {
		controller.abort()
		observer.disconnect()
		viewport.disconnect()
		cancelAnimationFrame(frame)
		clearTimeout(timer)
		progress?.cancel()
		dots?.replaceChildren()
		videos.forEach((video) => video?.pause())
	}
}
