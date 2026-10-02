import { announce } from '@/utils/announce'
import { showToast } from '@/utils/toast'

// Кнопка «Скопировать ссылку»: data-copy-link — адрес (пусто — текущая страница). После
// копирования на 1,6 секунды класс is-copied и сообщение для скринридера.
// data-copy-toast — вместо сообщения тост внизу экрана с этим текстом (библиотека документов),
// галочка на кнопке — 2 секунды.
export default function init(button) {
	const controller = new AbortController()
	const toastText = button.dataset.copyToast
	const time = toastText ? 2000 : 1600
	let timer = 0

	button.addEventListener(
		'click',
		async () => {
			const url = new URL(
				button.dataset.copyLink || window.location.href,
				window.location.href
			).href
			try {
				await navigator.clipboard.writeText(url)
				button.classList.add('is-copied')
				clearTimeout(timer)
				timer = setTimeout(() => button.classList.remove('is-copied'), time)
				if (toastText) showToast(toastText)
				else announce('Ссылка скопирована')
			} catch {
				announce('Не удалось скопировать ссылку')
			}
		},
		{ signal: controller.signal }
	)

	return () => {
		controller.abort()
		clearTimeout(timer)
	}
}
