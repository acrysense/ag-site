// Счётчики «В цифрах» (наше, в макете нет): когда блок впервые показывается на экране, числа
// плавно набегают от 0 и мягко замедляются к концу; пункты — друг за другом. Один раз.
// Значение пишет админ как угодно («2000+», «1 200», «30», «98,5%»): анимируется первое число,
// текст вокруг остаётся. Нет числа, «уменьшить движение» или нет JS — сразу итоговое значение.
// Итоговый текст остаётся в разметке (прозрачным): он держит ширину, чтобы ничего не прыгало,
// и его читает скринридер; бегущие цифры — поверх, скрыты от скринридера.
const DURATION = 1600
const STAGGER = 150
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

// Префикс, число (с пробелами-разделителями и дробной частью), остаток
const NUMBER = /^(\D*?)(\d{1,3}(?:[\s  ]\d{3})+|\d+)(?:([.,])(\d+))?(.*)$/s

const easeOut = (t) => 1 - (1 - t) ** 4

const parse = (text) => {
	const match = text.match(NUMBER)
	if (!match) return null
	const [, prefix, whole, mark = '', fraction = '', suffix] = match
	const separator = whole.match(/[\s  ]/)?.[0] || ''
	return {
		prefix,
		suffix,
		mark,
		decimals: fraction.length,
		separator,
		target: Number(`${whole.replace(/\D/g, '')}.${fraction || 0}`),
	}
}

const format = (value, { prefix, suffix, mark, decimals, separator }) => {
	const [whole, fraction] = value.toFixed(decimals).split('.')
	const grouped = separator ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : whole
	return `${prefix}${grouped}${fraction ? mark + fraction : ''}${suffix}`
}

export default function init(root) {
	const values = [...root.querySelectorAll('.stats__value')]
		.map((el) => ({ el, text: el.textContent.trim() }))
		.map((item) => ({ ...item, number: parse(item.text) }))
		.filter((item) => item.number)
	if (!values.length || reducedMotion.matches) return

	let frame = 0

	values.forEach((item) => {
		const final = document.createElement('span')
		final.className = 'stats__value-final'
		final.textContent = item.text
		item.counter = document.createElement('span')
		item.counter.className = 'stats__value-count'
		item.counter.setAttribute('aria-hidden', 'true')
		item.counter.textContent = format(0, item.number)
		item.el.replaceChildren(final, item.counter)
		item.el.classList.add('is-counting')
	})

	const finish = (item) => {
		item.el.classList.remove('is-counting')
		item.el.textContent = item.text
	}

	const run = () => {
		const start = performance.now()
		const tick = (now) => {
			let running = false
			values.forEach((item, index) => {
				if (!item.el.classList.contains('is-counting')) return
				const t = Math.min(1, Math.max(0, (now - start - index * STAGGER) / DURATION))
				if (t === 1) return finish(item)
				running = true
				item.counter.textContent = format(item.number.target * easeOut(t), item.number)
			})
			if (running) frame = requestAnimationFrame(tick)
		}
		frame = requestAnimationFrame(tick)
	}

	const observer = new IntersectionObserver(
		([entry]) => {
			if (!entry.isIntersecting) return
			observer.disconnect()
			run()
		},
		{ threshold: 0.4 }
	)
	observer.observe(root)

	return () => {
		observer.disconnect()
		cancelAnimationFrame(frame)
		values.forEach(finish)
	}
}
