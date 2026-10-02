import { announce } from '@/utils/announce'
import { createIcon } from '@/utils/icon'

// Тост внизу экрана (Figma, кит: Quick info 2543:906): type — ok (галочка), error (крестик),
// info (облачко). Показывается 2,5 с, один на страницу: новый заменяет текущий. Скринридеру —
// через общую live-область (announce). Элемент создаётся при первом показе и остаётся в body
// (как live-область), таймер — один. Разметка — как components/Toast/Toast.hbs. Бэку — событие
// ui:toast (app.js) или разметка с data-module="Toast" (components/Toast/Toast.js).
const TIME = 2500
const ICONS = { ok: 'tick', error: 'cross', info: 'comment' }
let toast = null
let timer = 0

export function showToast(message, type = 'ok') {
	if (!message) return
	toast?.remove()
	toast = document.createElement('div')
	toast.className = `toast toast--${type}`
	toast.setAttribute('aria-hidden', 'true')
	const text = document.createElement('span')
	text.className = 'toast__text'
	text.textContent = message
	toast.append(createIcon(ICONS[type] || ICONS.info, 'toast__icon'), text)
	document.body.append(toast)
	// Появление — со следующего кадра, после вставки
	void toast.offsetWidth
	toast.classList.add('is-visible')
	announce(message)
	clearTimeout(timer)
	const current = toast
	timer = setTimeout(() => current.classList.remove('is-visible'), TIME)
}
