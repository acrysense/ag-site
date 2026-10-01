// Мягкое проявление блоков при первой прокрутке (наше, в макете нет). Вешается на контейнер:
// <div data-module="Reveal" data-path="components">, проявляются его дочерние блоки; у ряда
// с data-reveal-row — каждый блок ряда отдельно. Скрываются только блоки ниже первого экрана
// (что видно при загрузке, не мигает); блок проявляется один раз, когда показался на экране:
// прозрачность и небольшой подъём, соседние — друг за другом. Без JS, при «уменьшить
// движение» и с панелью Битрикса всё видно сразу.
const STAGGER = 90
const MAX_STAGGER = 4
const DONE_AFTER = 1300
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export default function init(root) {
	// В режиме правки Битрикса (панель #bx-panel) админ видит все блоки сразу
	if (reducedMotion.matches || document.getElementById('bx-panel')) return

	const targets = [...root.children]
		.flatMap((child) => (child.hasAttribute('data-reveal-row') ? [...child.children] : [child]))
		.filter((el) => el.getBoundingClientRect().top > window.innerHeight)
	if (!targets.length) return

	const timers = new Set()
	targets.forEach((el) => el.classList.add('is-reveal-pending'))

	const clean = (el) => {
		el.classList.remove('is-reveal-pending', 'is-revealing')
		el.style.removeProperty('--reveal-delay')
	}

	const observer = new IntersectionObserver(
		(entries) => {
			const shown = entries
				.filter((entry) => entry.isIntersecting)
				.map((entry) => entry.target)
				.sort((a, b) => {
					const ra = a.getBoundingClientRect()
					const rb = b.getBoundingClientRect()
					return ra.top - rb.top || ra.left - rb.left
				})
			shown.forEach((el, index) => {
				observer.unobserve(el)
				el.style.setProperty(
					'--reveal-delay',
					`${Math.min(index, MAX_STAGGER) * STAGGER}ms`
				)
				el.classList.add('is-revealing')
				el.classList.remove('is-reveal-pending')
				const timer = setTimeout(
					() => {
						timers.delete(timer)
						clean(el)
					},
					DONE_AFTER + index * STAGGER
				)
				timers.add(timer)
			})
		},
		{ rootMargin: '0px 0px -8% 0px' }
	)
	targets.forEach((el) => observer.observe(el))

	// Проскочили мимо (End, якорь, быстрая прокрутка) — блок уже выше экрана: показываем сразу,
	// без анимации (наблюдатель о таком не сообщает — он ни разу не пересёк экран)
	const controller = new AbortController()
	let frame = 0
	const skipPassed = () => {
		cancelAnimationFrame(frame)
		frame = requestAnimationFrame(() => {
			targets.forEach((el) => {
				if (!el.classList.contains('is-reveal-pending')) return
				if (el.getBoundingClientRect().bottom >= 0) return
				observer.unobserve(el)
				clean(el)
			})
		})
	}
	window.addEventListener('scroll', skipPassed, { passive: true, signal: controller.signal })

	return () => {
		controller.abort()
		cancelAnimationFrame(frame)
		observer.disconnect()
		timers.forEach(clearTimeout)
		targets.forEach(clean)
	}
}
