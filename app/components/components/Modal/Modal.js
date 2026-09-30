import SimpleBar from 'simplebar'
import { lockBody } from '@/utils/scroll-lock'

// Модальное окно на <dialog>. Открывают кнопка data-modal-open="<id>" и событие modal:open на
// самом окне (из скрипта: форма после отправки открывает окно «Спасибо»). Закрывают
// data-modal-close, Escape и нажатие по фону. Фокус внутри и его возврат — нативные у <dialog>.
//
// Блокировка прокрутки снимается сразу при закрытии: событие close у <dialog> асинхронное
// (в фоновой вкладке Chrome не доставляет его вовсе). Окно поверх окна снимает только свою.
//
// Форма с несохранёнными изменениями ([data-form-dirty], ставит модуль Form) перед закрытием
// спрашивает подтверждение — окно с data-modal-discard (одно на странице). «Закрыть» в нём
// сбрасывает форму и закрывает оба окна.
export default function init(dialog) {
	const controller = new AbortController()
	const { signal } = controller
	const isStatic = dialog.classList.contains('modal--static')
	const isDiscard = dialog.hasAttribute('data-modal-discard')
	const body = dialog.querySelector('.modal__body')
	let release = null
	let simplebar = null
	let onDiscardConfirm = null

	const cleanup = () => {
		release?.()
		release = null
	}

	const open = () => {
		if (dialog.open) return
		dialog.showModal()
		release?.()
		release = lockBody()
		// Прокрутка тела — только когда окно видно: SimpleBar меряет содержимое
		if (body && !simplebar) simplebar = new SimpleBar(body, { autoHide: false })
		simplebar?.recalculate()
		// Область прокрутки в фокусе нужна, только если прокручивать есть что (стрелками)
		const scroller = simplebar?.getScrollElement()
		if (scroller) scroller.tabIndex = scroller.scrollHeight > scroller.clientHeight + 1 ? 0 : -1
		// Начальный фокус: [autofocus] (в подтверждении — «Отмена»), иначе первая кнопка или поле
		const target =
			dialog.querySelector('[autofocus]') ||
			dialog.querySelector('button, [href], input, select, textarea, [tabindex="0"]')
		target?.focus()
		dialog.dispatchEvent(new CustomEvent('modal:opened'))
	}

	const forceClose = () => {
		if (!dialog.open || isStatic) return
		dialog.close()
		cleanup()
		onDiscardConfirm = null
		dialog.dispatchEvent(new CustomEvent('modal:closed'))
	}

	const requestClose = () => {
		const form = dialog.querySelector('form[data-form-dirty]')
		const discard = document.querySelector('dialog[data-modal-discard]')
		if (form && discard && discard !== dialog) {
			discard.dispatchEvent(
				new CustomEvent('modal:open', {
					detail: {
						onConfirm: () => {
							form.reset()
							form.removeAttribute('data-form-dirty')
							form.dispatchEvent(new CustomEvent('form:reset'))
							forceClose()
						},
					},
				})
			)
			return
		}
		forceClose()
	}

	document.addEventListener(
		'click',
		(event) => {
			const opener = event.target.closest(`[data-modal-open="${CSS.escape(dialog.id)}"]`)
			if (!opener) return
			event.preventDefault()
			open()
		},
		{ signal }
	)

	dialog.addEventListener(
		'modal:open',
		(event) => {
			if (isDiscard) onDiscardConfirm = event.detail?.onConfirm || null
			open()
		},
		{ signal }
	)
	dialog.addEventListener('modal:close', forceClose, { signal })

	dialog.addEventListener(
		'click',
		(event) => {
			// Нажатие по самому <dialog> — это фон: панель занимает всё остальное
			if (event.target === dialog || event.target.closest('[data-modal-close]')) {
				requestClose()
				return
			}
			if (isDiscard && event.target.closest('[data-modal-discard-confirm]')) {
				const confirm = onDiscardConfirm
				forceClose()
				confirm?.()
			}
		},
		{ signal }
	)

	// Escape: cancel приходит синхронно, до закрытия — закрываем сами, чтобы спросить о форме
	dialog.addEventListener(
		'cancel',
		(event) => {
			event.preventDefault()
			requestClose()
		},
		{ signal }
	)
	dialog.addEventListener('close', () => !dialog.open && cleanup(), { signal })

	return () => {
		controller.abort()
		forceClose()
		simplebar?.unMount()
	}
}
