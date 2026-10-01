// Многострочное поле растёт по высоте с текстом, прокрутки внутри нет никогда.
// data-autosize-max-rows — предел: дошли до него — новый текст не вводится (вставка обрезается
// по месту), удалять можно всегда. Длину ограничивает maxlength.
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

// Предел высоты содержимого (scrollHeight) или null
function getLimit(el) {
	const maxRows = getMaxRows(el)
	if (!maxRows) return null
	const { styles, padding } = getMetrics(el)
	return Math.ceil(maxRows * getLineHeightPx(el, styles) + padding)
}

function overflows(el, limit) {
	el.style.height = 'auto'
	return el.scrollHeight > limit + 1
}

// Высота — по тексту. Текст, который уже не помещается (поле сузилось, значение от бэка),
// не прячется под прокрутку: поле становится выше
function resize(el) {
	const { border, isBorderBox } = getMetrics(el)
	el.style.height = 'auto'
	el.style.height = `${Math.ceil(el.scrollHeight + (isBorderBox ? border : 0))}px`
	el.style.overflowY = 'hidden'
}

// Новый текст не поместился — оставляем столько вставленного, сколько влезает
function fit(el, previous) {
	const limit = getLimit(el)
	if (!limit || previous === null || !overflows(el, limit)) return false
	const value = el.value
	let start = 0
	while (start < previous.length && value[start] === previous[start]) start++
	let end = 0
	while (
		end < previous.length - start &&
		end < value.length - start &&
		value[value.length - 1 - end] === previous[previous.length - 1 - end]
	)
		end++
	const before = value.slice(0, start)
	const inserted = value.slice(start, value.length - end)
	const after = value.slice(value.length - end)
	let low = 0
	let high = inserted.length
	while (low < high) {
		const middle = Math.ceil((low + high) / 2)
		el.value = before + inserted.slice(0, middle) + after
		if (overflows(el, limit)) high = middle - 1
		else low = middle
	}
	el.value = before + inserted.slice(0, low) + after
	el.setSelectionRange(start + low, start + low)
	return el.value !== value
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
	let previous = null
	// Значение до ввода. При наборе через IME (и на клавиатурах Android) — до начала набора,
	// проверка — после его окончания
	const onBeforeInput = (event) => {
		if (!event.isComposing) previous = el.value
	}
	const onCompositionStart = () => {
		previous = el.value
	}
	const check = () => {
		// Обрезали — сообщаем остальным (счётчики, проверка формы) уже итоговое значение
		if (fit(el, previous)) el.dispatchEvent(new Event('input', { bubbles: true }))
		previous = null
		resize(el)
	}
	const onInput = (event) => {
		if (event.isComposing) resize(el)
		else check()
	}
	const onResize = () => resize(el)
	const onReset = () => {
		cancelAnimationFrame(resetFrame)
		resetFrame = requestAnimationFrame(() => active && resize(el))
	}
	const onWindowResize = () => {
		clearTimeout(timer)
		timer = setTimeout(() => active && resize(el), 50)
	}

	el.addEventListener('beforeinput', onBeforeInput)
	el.addEventListener('compositionstart', onCompositionStart)
	el.addEventListener('compositionend', check)
	el.addEventListener('input', onInput)
	el.form?.addEventListener('reset', onReset)
	window.addEventListener('resize', onWindowResize)

	const resizeObserver =
		typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize)
	resizeObserver?.observe(el)

	const cleanup = () => {
		if (!active) return
		active = false
		clearTimeout(timer)
		cancelAnimationFrame(resetFrame)
		resizeObserver?.disconnect()
		el.removeEventListener('beforeinput', onBeforeInput)
		el.removeEventListener('compositionstart', onCompositionStart)
		el.removeEventListener('compositionend', check)
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
