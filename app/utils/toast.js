import { announce } from '@/utils/announce'
import { createIcon } from '@/utils/icon'

// Тост внизу экрана (Figma: Doc/Toast 4526:29740): «✓ Ссылка скопирована» на 2,5 с. Один на
// страницу: новый заменяет текущий. Скринридеру — через общую live-область (announce).
// Элемент создаётся при первом показе и остаётся в body (как live-область), таймер — один.
const TIME = 2500
let toast = null
let text = null
let timer = 0

export function showToast(message) {
	if (!toast) {
		toast = document.createElement('div')
		toast.className = 'toast'
		toast.setAttribute('aria-hidden', 'true')
		text = document.createElement('span')
		text.className = 'toast__text'
		toast.append(createIcon('tick', 'toast__icon'), text)
		document.body.append(toast)
	}
	text.textContent = message
	// Перезапуск появления, если тост ещё виден
	toast.classList.remove('is-visible')
	void toast.offsetWidth
	toast.classList.add('is-visible')
	announce(message)
	clearTimeout(timer)
	timer = setTimeout(() => toast.classList.remove('is-visible'), TIME)
}
