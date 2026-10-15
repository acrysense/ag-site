// Праздничный салют в день рождения: конфетти вылетает веером, снизу поднимаются шары. Рисуется на
// холсте поверх страницы (нажатия проходят сквозь него), около 4 с, потом холст удаляется.
// Два вида блока (бэк выводит его только в день рождения):
// - невидимый (основной) — салют запускается сам, конфетти летит от data-celebration-origin (фото);
// - метка-кнопка (запасной) — то же, конфетти от метки, нажатие повторяет салют.
// Сам — раз в день на сотрудника (localStorage, ключ — data-celebration-key): после полной загрузки
// страницы и только на видимой вкладке; «показан сегодня» записывается, когда салют нарисовался.
// Повтор вручную — нажатием на метку или на кнопку [data-celebration-play] (тестовая, только в демо):
// залп не чаще раза в COOLDOWN, частиц и шаров на экране не больше MAX_* — частые нажатия не
// нагружают страницу. «Уменьшить движение» — конфетти проявляется и гаснет на месте, без полёта и
// шаров. Цвета — из CSS-переменных блока (--celebration-*, палитра в Celebration.scss).
const STORE = 'ag:celebrated:'
const GRAVITY = 900 // пикселей в секунду²
const DRAG = 1.4 // торможение конфетти в воздухе, доля скорости в секунду
const FADE = 0.6 // последние секунды жизни конфетти — гаснет
const AUTO_DELAY = 450 // после загрузки страницы — чтобы её успели увидеть
const COOLDOWN = 1500 // между залпами вручную
const MAX_PIECES = 450
const MAX_BALLOONS = 10
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

const random = (min, max) => min + Math.random() * (max - min)
const pick = (list) => list[Math.floor(Math.random() * list.length)]
const today = () => {
	const date = new Date()
	return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const key = root.dataset.celebrationKey
	let canvas = null
	let ctx = null
	let frame = 0
	let last = 0
	let timer = 0
	let lastPlay = -Infinity
	let pieces = []
	let balloons = []

	const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim()
	const colors = () => {
		const list = ['--celebration-pink', '--celebration-gold', '--celebration-blue']
			.map(cssVar)
			.filter(Boolean)
		return list.length ? list : ['currentColor']
	}
	let stringColor = ''
	let shineColor = ''

	const resize = () => {
		if (!canvas) return
		const ratio = Math.min(2, window.devicePixelRatio || 1)
		canvas.width = Math.round(window.innerWidth * ratio)
		canvas.height = Math.round(window.innerHeight * ratio)
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
	}

	const stop = () => {
		cancelAnimationFrame(frame)
		frame = 0
		pieces = []
		balloons = []
		window.removeEventListener('resize', resize)
		canvas?.remove()
		canvas = null
		ctx = null
	}

	// ---------- Частицы ----------

	// Залп из точки: веер вверх, разлёт шире на широком экране
	const burst = (x, y, palette) => {
		const count = Math.min(window.innerWidth < 768 ? 90 : 150, MAX_PIECES - pieces.length)
		for (let i = 0; i < count; i++) {
			const angle = random(-Math.PI * 0.88, -Math.PI * 0.12)
			const speed = random(380, 980)
			pieces.push({
				x,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				w: random(6, 11),
				h: random(3, 6),
				round: Math.random() < 0.3,
				angle: random(0, Math.PI * 2),
				spin: random(-9, 9),
				flip: random(0, Math.PI * 2), // «переворот» листочка — сужение по ширине
				flipSpeed: random(6, 13),
				color: pick(palette),
				life: random(2.6, 3.6),
				age: 0,
				opacity: 1,
			})
		}
	}

	// Без движения: листочки вокруг метки проявляются и гаснут
	const sprinkle = (x, y, palette) => {
		const count = Math.min(40, MAX_PIECES - pieces.length)
		for (let i = 0; i < count; i++) {
			const angle = random(0, Math.PI * 2)
			const distance = random(24, 170)
			pieces.push({
				x: x + Math.cos(angle) * distance,
				y: y + Math.sin(angle) * distance * 0.6,
				vx: 0,
				vy: 0,
				w: random(6, 10),
				h: random(3, 5),
				round: Math.random() < 0.3,
				angle: random(0, Math.PI * 2),
				spin: 0,
				flip: 0, // плашмя — видна вся ширина
				flipSpeed: 0,
				color: pick(palette),
				life: 1.8,
				age: 0,
				still: true,
				opacity: 0,
			})
		}
	}

	// Шары снизу экрана: поднимаются с покачиванием и уходят за верхний край за 3–4 с на любой
	// высоте экрана
	const launchBalloons = (palette) => {
		const width = window.innerWidth
		const height = window.innerHeight
		const count = Math.min(width < 768 ? 3 : 5, MAX_BALLOONS - balloons.length)
		for (let i = 0; i < count; i++) {
			const radius = width < 768 ? random(18, 24) : random(24, 32)
			const start = height + radius * 2 + random(0, 80)
			balloons.push({
				x: (width / (count + 1)) * (i + 1) + random(-30, 30),
				y: start,
				r: radius,
				speed: (start + radius * 5) / random(3.2, 4.2),
				sway: random(10, 22),
				phase: random(0, Math.PI * 2),
				color: palette[i % palette.length],
				age: 0,
			})
		}
	}

	const update = (dt) => {
		pieces = pieces.filter((piece) => {
			piece.age += dt
			if (piece.age >= piece.life) return false
			if (piece.still) {
				// проявление 0,3 с, гаснет к концу
				piece.opacity = Math.min(1, piece.age / 0.3, (piece.life - piece.age) / 0.6)
				return true
			}
			piece.vx -= piece.vx * DRAG * dt
			piece.vy += GRAVITY * dt - piece.vy * DRAG * dt
			piece.x += piece.vx * dt + Math.sin(piece.age * 5 + piece.flip) * 18 * dt
			piece.y += piece.vy * dt
			piece.angle += piece.spin * dt
			piece.flip += piece.flipSpeed * dt
			piece.opacity = Math.min(1, (piece.life - piece.age) / FADE)
			return piece.y < window.innerHeight + 40
		})
		balloons = balloons.filter((balloon) => {
			balloon.age += dt
			balloon.y -= balloon.speed * dt
			return balloon.y > -balloon.r * 5
		})
	}

	const drawPiece = (piece) => {
		ctx.save()
		ctx.globalAlpha = Math.max(0, piece.opacity)
		ctx.translate(piece.x, piece.y)
		ctx.rotate(piece.angle)
		ctx.scale(Math.abs(Math.cos(piece.flip)) * 0.85 + 0.15, 1)
		ctx.fillStyle = piece.color
		if (piece.round) {
			ctx.beginPath()
			ctx.arc(0, 0, piece.h, 0, Math.PI * 2)
			ctx.fill()
		} else ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h)
		ctx.restore()
	}

	const drawBalloon = (balloon) => {
		const { r, color } = balloon
		const x = balloon.x + Math.sin(balloon.age * 1.6 + balloon.phase) * balloon.sway
		const y = balloon.y
		const tilt = Math.cos(balloon.age * 1.6 + balloon.phase) * 0.08
		// нитка: качается вслед за шаром
		ctx.save()
		ctx.strokeStyle = stringColor
		ctx.lineWidth = 1
		ctx.beginPath()
		ctx.moveTo(x, y + r * 1.25)
		ctx.bezierCurveTo(
			x - balloon.sway * 0.6,
			y + r * 2,
			x + balloon.sway * 0.6,
			y + r * 2.8,
			x - tilt * 120,
			y + r * 3.6
		)
		ctx.stroke()
		ctx.translate(x, y)
		ctx.rotate(tilt)
		// узелок
		ctx.fillStyle = color
		ctx.beginPath()
		ctx.moveTo(-r * 0.14, r * 1.28)
		ctx.lineTo(r * 0.14, r * 1.28)
		ctx.lineTo(0, r * 1.12)
		ctx.closePath()
		ctx.fill()
		// шар и блик
		ctx.beginPath()
		ctx.ellipse(0, 0, r, r * 1.18, 0, 0, Math.PI * 2)
		ctx.fill()
		const shine = ctx.createRadialGradient(-r * 0.35, -r * 0.45, 0, -r * 0.35, -r * 0.45, r * 0.9)
		shine.addColorStop(0, shineColor)
		shine.addColorStop(1, 'transparent')
		ctx.fillStyle = shine
		ctx.fill()
		ctx.restore()
	}

	const loop = (now) => {
		const dt = Math.min(0.033, (now - last) / 1000 || 0)
		last = now
		update(dt)
		ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
		balloons.forEach(drawBalloon)
		pieces.forEach(drawPiece)
		if (!pieces.length && !balloons.length) return stop()
		frame = requestAnimationFrame(loop)
	}

	// Откуда залп: метка (если блок видимый) или фото (data-celebration-origin), если на экране;
	// иначе — верхняя треть экрана
	const origin = () => {
		const selector = root.dataset.celebrationOrigin
		const target = root.hidden ? (selector ? document.querySelector(selector) : null) : root
		const rect = target?.getBoundingClientRect()
		const onScreen = rect && rect.width && rect.bottom > 0 && rect.top < window.innerHeight
		if (!onScreen) return { x: window.innerWidth / 2, y: window.innerHeight / 3 }
		return { x: rect.left + rect.width / 2, y: Math.max(rect.top + rect.height / 2, 24) }
	}

	// Залп; false — не нарисовался (рано после прошлого или холст недоступен)
	const play = () => {
		const now = performance.now()
		if (now - lastPlay < COOLDOWN) return false
		const palette = colors()
		stringColor = cssVar('--celebration-string') || 'transparent'
		shineColor = cssVar('--celebration-shine') || 'transparent'
		const { x, y } = origin()
		if (!canvas) {
			canvas = document.createElement('canvas')
			canvas.className = 'celebration-canvas'
			canvas.setAttribute('aria-hidden', 'true')
			ctx = canvas.getContext('2d')
			if (!ctx) {
				stop()
				return false
			}
			document.body.append(canvas)
			resize()
			window.addEventListener('resize', resize)
		}
		lastPlay = now
		if (reducedMotion.matches) sprinkle(x, y, palette)
		else {
			burst(x, y, palette)
			launchBalloons(palette)
		}
		if (!frame) {
			last = performance.now()
			frame = requestAnimationFrame(loop)
		}
		return true
	}

	// Вручную: нажатие на метку или на тестовую кнопку демо
	if (!root.hidden) root.addEventListener('click', () => play(), { signal })
	document.addEventListener(
		'click',
		(event) => {
			// data-celebration-play="key" — только свой салют; пусто — любой на странице
			const button = event.target.closest('[data-celebration-play]')
			if (button && (!button.dataset.celebrationPlay || button.dataset.celebrationPlay === key)) play()
		},
		{ signal }
	)

	// Сам — раз в день на сотрудника; вкладка в фоне — когда её откроют
	const seen = () => {
		if (!key) return false
		try {
			return localStorage.getItem(STORE + key) === today()
		} catch {
			return false
		}
	}
	const remember = () => {
		if (!key) return
		try {
			localStorage.setItem(STORE + key, today())
		} catch {}
	}
	// Старт — после полной загрузки страницы и только на видимой вкладке; «показан сегодня»
	// записывается, когда салют действительно нарисовался
	const visible = () => document.visibilityState === 'visible'
	const start = () => {
		if (timer || seen() || !visible()) return
		timer = setTimeout(() => {
			timer = 0
			if (visible() && play()) remember()
		}, AUTO_DELAY)
	}
	if (!seen()) {
		if (document.readyState === 'complete') start()
		else window.addEventListener('load', start, { once: true, signal })
		document.addEventListener(
			'visibilitychange',
			() => document.readyState === 'complete' && start(),
			{ signal }
		)
	}

	return () => {
		controller.abort()
		clearTimeout(timer)
		stop()
	}
}
