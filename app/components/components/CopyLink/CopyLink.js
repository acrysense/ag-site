import { showToast } from '@/utils/toast'

// Кнопка «Скопировать ссылку»: data-copy-link — адрес (пусто — текущая страница). После
// копирования на 2 секунды класс is-copied (на кнопке — галочка) и тост «Ссылка скопирована»
// (Figma, кит: Quick info · Ok); не получилось — тост с ошибкой.
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
				showToast('Ссылка скопирована', 'ok')
			} catch {
				showToast('Не удалось скопировать ссылку', 'error')
			}
		},
		{ signal: controller.signal }
	)

	return () => {
		controller.abort()
		clearTimeout(timer)
	}
}
