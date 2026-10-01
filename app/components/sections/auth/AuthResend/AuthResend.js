import { announce } from '@/utils/announce'

// «Запросить код повторно»: пока не прошло data-resend-wait секунд (бэк ставит после отправки
// кода), кнопка неактивна и показывает отсчёт; потом — снова доступна, это объявляется
// скринридеру. Сам запрос — обычная отправка формы (кнопка с name=resend, formnovalidate).
export default function init(button) {
	const text = button.textContent.trim()
	const template = button.dataset.resendCountdown || '{s}'
	let left = Number(button.dataset.resendWait) || 0
	let timer = 0
	if (left <= 0) return () => {}

	const render = () => {
		button.textContent = template.replace('{s}', String(left))
	}
	button.disabled = true
	render()
	timer = setInterval(() => {
		left -= 1
		if (left > 0) return render()
		clearInterval(timer)
		timer = 0
		button.disabled = false
		button.textContent = text
		announce(text)
	}, 1000)

	return () => clearInterval(timer)
}
