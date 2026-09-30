const SELECTOR = 'textarea[data-autosize]'
const bound = new WeakMap()
const observers = new WeakMap()

function getMaxRows(el) {
	const rows = Number.parseInt(el.getAttribute('data-autosize-max-rows') || '', 10)
	return Number.isFinite(rows) && rows > 0 ? rows : null
}

function getLineHeightPx(el, styles) {
	const lineHeight = Number.parseFloat(styles.lineHeight)
	if (styles.lineHeight.endsWith('px')) return lineHeight
	return Number.isFinite(lineHeight) ? lineHeight * Number.parseFloat(styles.fontSize) : 19.2
}

function getMetrics(el) {
	const styles = getComputedStyle(el)
	const border =
		(Number.parseFloat(styles.borderTopWidth) || 0) +
		(Number.parseFloat(styles.borderBottomWidth) || 0)
	const padding =
		(Number.parseFloat(styles.paddingTop) || 0) + (Number.parseFloat(styles.paddingBottom) || 0)

	return { styles, border, padding, isBorderBox: styles.boxSizing === 'border-box' }
}

function resize(el) {
	const { styles, border, padding, isBorderBox } = getMetrics(el)
	const maxRows = getMaxRows(el)
	const maxHeight = maxRows
		? Math.ceil(maxRows * getLineHeightPx(el, styles) + padding + (isBorderBox ? border : 0))
		: null

	el.style.height = 'auto'

	const naturalHeight = el.scrollHeight + (isBorderBox ? border : 0)
	const targetHeight = maxHeight ? Math.min(naturalHeight, maxHeight) : naturalHeight

	el.style.height = `${Math.ceil(targetHeight)}px`
	el.style.overflowY = maxHeight && naturalHeight > maxHeight ? 'auto' : 'hidden'
}

function collect(root) {
	const items = root.matches?.(SELECTOR) ? [root] : []
	return items.concat([...(root.querySelectorAll?.(SELECTOR) || [])])
}

function destroy(el) {
	bound.get(el)?.()
}

function bind(el) {
	if (bound.has(el)) return

	let active = true
	let timer
	let resetFrame
	const onInput = () => resize(el)
	const onReset = () => {
		cancelAnimationFrame(resetFrame)
		resetFrame = requestAnimationFrame(() => active && resize(el))
	}
	const onWindowResize = () => {
		clearTimeout(timer)
		timer = setTimeout(() => active && resize(el), 50)
	}

	el.addEventListener('input', onInput, { passive: true })
	el.form?.addEventListener('reset', onReset)
	window.addEventListener('resize', onWindowResize)

	const resizeObserver =
		typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onInput)
	resizeObserver?.observe(el)

	const cleanup = () => {
		if (!active) return
		active = false
		clearTimeout(timer)
		cancelAnimationFrame(resetFrame)
		resizeObserver?.disconnect()
		el.removeEventListener('input', onInput)
		el.form?.removeEventListener('reset', onReset)
		window.removeEventListener('resize', onWindowResize)
		bound.delete(el)
	}

	bound.set(el, cleanup)
	resize(el)

	document.fonts?.ready.then(() => active && el.isConnected && resize(el))
}

export function autosize(root = document) {
	collect(root).forEach(bind)

	if (observers.has(root) || typeof MutationObserver === 'undefined') {
		return observers.get(root) || (() => collect(root).forEach(destroy))
	}

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			mutation.removedNodes.forEach((node) => {
				if (node instanceof Element) collect(node).forEach(destroy)
			})
			mutation.addedNodes.forEach((node) => {
				if (node instanceof Element) collect(node).forEach(bind)
			})
		}
	})

	observer.observe(root, { childList: true, subtree: true })

	const cleanup = () => {
		observer.disconnect()
		collect(root).forEach(destroy)
		observers.delete(root)
	}

	observers.set(root, cleanup)
	return cleanup
}
