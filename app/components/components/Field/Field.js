// Поле пароля с «глазом»: показать или скрыть введённое. Кнопка остаётся на месте, фокус не уходит
// из поля при повторном вводе; состояние — aria-pressed и подпись кнопки.
export default function init(root) {
	const input = root.querySelector('.field__control')
	const button = root.querySelector('[data-field-reveal]')
	if (!input || !button) return () => {}

	const onClick = () => {
		const show = input.type === 'password'
		input.type = show ? 'text' : 'password'
		button.setAttribute('aria-pressed', String(show))
		button.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль')
	}
	button.addEventListener('click', onClick)

	return () => {
		button.removeEventListener('click', onClick)
		// Перед уходом со страницы пароль снова скрыт: браузер не запомнит его открытым
		input.type = 'password'
	}
}
