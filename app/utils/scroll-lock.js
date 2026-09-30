const FIXED_SELECTOR = '[data-fix]'

let lockDepth = 0
let scrollY = 0
let savedBodyStyles = null
let savedFixedStyles = []

function releaseLock() {
	if (lockDepth === 0) return
	lockDepth -= 1
	if (lockDepth > 0) return

	const html = document.documentElement
	const body = document.body

	body.classList.remove('is-locked')
	html.classList.remove('is-locked')
	body.style.top = savedBodyStyles?.top || ''
	body.style.paddingRight = savedBodyStyles?.paddingRight || ''

	for (const { el, paddingRight } of savedFixedStyles) {
		if (el.isConnected) el.style.paddingRight = paddingRight
	}

	savedBodyStyles = null
	savedFixedStyles = []
	window.scrollTo(0, scrollY)
}

export function lockBody() {
	lockDepth += 1
	if (lockDepth === 1) {
		const html = document.documentElement
		const body = document.body
		const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth)

		scrollY = window.scrollY || html.scrollTop || 0
		savedBodyStyles = {
			top: body.style.top,
			paddingRight: body.style.paddingRight,
		}
		savedFixedStyles = [...document.querySelectorAll(FIXED_SELECTOR)].map((el) => ({
			el,
			paddingRight: el.style.paddingRight,
		}))

		body.style.top = `-${scrollY}px`
		if (scrollbarWidth > 0) {
			body.style.paddingRight = `${(Number.parseFloat(getComputedStyle(body).paddingRight) || 0) + scrollbarWidth}px`
			for (const { el } of savedFixedStyles) {
				el.style.paddingRight = `${(Number.parseFloat(getComputedStyle(el).paddingRight) || 0) + scrollbarWidth}px`
			}
		}

		body.classList.add('is-locked')
		html.classList.add('is-locked')
	}

	let released = false
	return () => {
		if (released) return
		released = true
		releaseLock()
	}
}

export function unlockBody() {
	releaseLock()
}
