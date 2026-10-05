// Браузеры без :has() (Firefox до 121): выбранный вариант в «таблетках» фильтров и разделах
// поиска подсвечивается классом is-checked на <label> — стили там же, где :has(:checked).
// В браузерах с :has() ничего не делает. Бэку ничего не нужно: разметка та же.
const supportsHas = () => {
	try {
		return CSS.supports('selector(:has(*))')
	} catch {
		return false
	}
}

export function watchCheckedLabels() {
	if (supportsHas()) return () => {}

	const sync = () => {
		frame = 0
		document.querySelectorAll('label').forEach((label) => {
			const input = label.querySelector('input[type="checkbox"], input[type="radio"]')
			if (input) label.classList.toggle('is-checked', input.checked)
		})
	}
	// Пересчёт не чаще раза за кадр: выбор, клик (поля меняют скриптом), сброс формы, новые блоки
	let frame = 0
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(sync)
	}
	const events = ['change', 'input', 'click', 'reset']
	events.forEach((type) => document.addEventListener(type, schedule, true))
	const observer = new MutationObserver(schedule)
	observer.observe(document.body, { childList: true, subtree: true })
	sync()

	return () => {
		events.forEach((type) => document.removeEventListener(type, schedule, true))
		observer.disconnect()
		cancelAnimationFrame(frame)
	}
}
