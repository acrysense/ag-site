import { lockBody } from '@/utils/scroll-lock'

// Шторка открывается кнопкой с data-sheet-open="<id>", закрывается кнопкой с
// data-sheet-close, Escape и нажатием по фону. Фокус и его возврат — нативные у <dialog>.
// Блокировка прокрутки снимается сразу при закрытии: событие close у <dialog>
// асинхронное (в фоновой вкладке Chrome не доставляет его вовсе).
export default function init(dialog) {
	const controller = new AbortController()
	const { signal } = controller
	let release = null
	// Показанная заранее шторка в витрине не закрывается
	const isStatic = dialog.classList.contains('sheet--static')

	const cleanup = () => {
		release?.()
		release = null
	}

	const close = () => {
		if (!dialog.open || isStatic) return
		dialog.close()
		cleanup()
	}

	document.addEventListener(
		'click',
		(event) => {
			const opener = event.target.closest(`[data-sheet-open="${dialog.id}"]`)
			if (!opener || dialog.open) return
			event.preventDefault()
			dialog.showModal()
			release?.()
			release = lockBody()
		},
		{ signal }
	)

	dialog.addEventListener(
		'click',
		(event) => {
			// Нажатие по самому <dialog> — это фон: панель занимает всё остальное
			if (event.target === dialog || event.target.closest('[data-sheet-close]')) close()
		},
		{ signal }
	)

	// Escape: cancel приходит синхронно, до закрытия
	dialog.addEventListener('cancel', cleanup, { signal })
	dialog.addEventListener('close', () => !dialog.open && cleanup(), { signal })

	return () => {
		controller.abort()
		close()
	}
}
