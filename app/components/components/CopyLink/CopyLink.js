import { announce } from '@/utils/announce'

// Кнопка «Скопировать ссылку»: data-copy-link — адрес (пусто — текущая страница). После
// копирования на 2 секунды класс is-copied и сообщение для скринридера.
export default function init(button) {
	const controller = new AbortController()
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
				timer = setTimeout(() => button.classList.remove('is-copied'), 2000)
				announce('Ссылка скопирована')
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
