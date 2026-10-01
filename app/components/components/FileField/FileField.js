// Поле «прикрепить файл»: показывает имя выбранного файла вместо подсказки, × очищает выбор.
// Проверку размера и типа делает модуль Form при отправке. После сброса формы (отправлена,
// «Закрыть форму?») поле возвращается к подсказке.
export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const input = root.querySelector('.file-field__input')
	const text = root.querySelector('[data-file-text]')
	const clear = root.querySelector('[data-file-clear]')
	let timer = 0
	if (!input || !text) return () => {}

	const render = () => {
		const file = input.files?.[0]
		text.textContent = file ? file.name : text.dataset.placeholder || ''
		root.classList.toggle('has-file', Boolean(file))
		if (clear) clear.hidden = !file
	}

	input.addEventListener('change', render, { signal })
	clear?.addEventListener(
		'click',
		() => {
			input.value = ''
			// Форма узнаёт об изменении: снимает ошибку и пересчитывает «изменена ли»
			input.dispatchEvent(new Event('change', { bubbles: true }))
			input.focus()
		},
		{ signal }
	)
	// reset приходит до сброса значений — перерисовка после него
	input.form?.addEventListener(
		'reset',
		() => {
			clearTimeout(timer)
			timer = setTimeout(render)
		},
		{ signal }
	)
	render()

	return () => {
		controller.abort()
		clearTimeout(timer)
	}
}
