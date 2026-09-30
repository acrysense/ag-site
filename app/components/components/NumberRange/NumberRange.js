// Числовой диапазон: в поле — только цифры, разряды через пробел («1 500»); курсор при этом
// не прыгает. В форму уходят цифры без пробелов (событие formdata). Изменили значение и ушли
// из поля (или Enter) — change; с data-number-range-submit — отправка формы.
const group = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const inputs = [...root.querySelectorAll('.number-range__input')]
	const form = inputs[0]?.form

	const format = (input) => {
		const caret = input.selectionStart ?? input.value.length
		const digitsBefore = input.value.slice(0, caret).replace(/\D/g, '').length
		const digits = input.value
			.replace(/\D/g, '')
			.replace(/^0+(?=\d)/, '')
			.slice(0, 12)
		const next = group(digits)
		if (next === input.value) return
		input.value = next
		// Курсор — после того же числа цифр
		let position = 0
		for (let seen = 0; position < next.length && seen < digitsBefore; position++)
			if (/\d/.test(next[position])) seen++
		if (document.activeElement === input) input.setSelectionRange(position, position)
	}

	inputs.forEach((input) => {
		format(input)
		input.addEventListener('input', () => format(input), { signal })
		input.addEventListener(
			'change',
			() => {
				if (root.hasAttribute('data-number-range-submit')) form?.requestSubmit()
			},
			{ signal }
		)
	})

	form?.addEventListener(
		'formdata',
		(event) => {
			inputs.forEach((input) => {
				if (input.name && event.formData.has(input.name))
					event.formData.set(input.name, input.value.replace(/\D/g, ''))
			})
		},
		{ signal }
	)

	return () => controller.abort()
}
