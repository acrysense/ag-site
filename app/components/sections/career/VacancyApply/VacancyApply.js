// Окно заявки на вакансию: «Откликнуться» (data-vacancy-apply="<id вакансии>",
// data-vacancy-apply-title) подставляет вакансию в скрытое поле и подпись под заголовком.
// Заявка открывается вместо окна вакансии, не поверх: окно вакансии
// закрывается. Закрыли заявку, не отправив, — окно той же вакансии открывается снова; после
// отправки открывается «Заявка принята» — «Вернуться к вакансиям» ведёт к списку.
// Модуль висит на строке с вакансией (data-vacancy-apply-subtitle) внутри окна заявки: у окна
// свой модуль Modal, у формы — Form.
export default function init(subtitle) {
	const controller = new AbortController()
	const { signal } = controller
	const root = subtitle.closest('dialog')
	if (!root) return () => {}
	const form = root.querySelector('form')
	const input = root.querySelector('[data-vacancy-apply-id]')
	const success = form?.dataset.formSuccess
		? document.getElementById(form.dataset.formSuccess)
		: null
	// Окно вакансии, из которого открыли заявку, — куда вернуться, и его «Откликнуться» (фокус)
	let source = null
	let sourceButton = null

	document.addEventListener(
		'click',
		(event) => {
			const trigger = event.target.closest(`[data-modal-open="${CSS.escape(root.id)}"]`)
			if (!trigger || !input) return
			input.value = trigger.dataset.vacancyApply || ''
			subtitle.textContent = trigger.dataset.vacancyApplyTitle || ''
			subtitle.hidden = !subtitle.textContent
			// Новая вакансия — новая исходная точка: подстановка не считается изменением формы
			form?.dispatchEvent(new CustomEvent('form:reset'))
			source = trigger.closest('dialog')
			sourceButton = trigger
			source?.dispatchEvent(new CustomEvent('modal:close'))
		},
		{ signal }
	)

	// После отправки форма закрывает заявку и сразу открывает «Заявка принята» — тогда к вакансии
	// не возвращаемся. Поэтому решаем чуть позже закрытия (microtask), когда «Заявка принята» уже
	// открылась и сбросила source
	root.addEventListener(
		'modal:closed',
		() => {
			const back = source
			if (!back) return
			queueMicrotask(() => {
				if (signal.aborted || source !== back) return
				source = null
				back.dispatchEvent(new CustomEvent('modal:open'))
				// Фокус — туда, откуда ушли (с клавиатуры удобно продолжить), а не на крестик
				sourceButton?.focus()
				// Окна открывались по очереди, и браузер не помнит, откуда пришли: после закрытия
				// окна вакансии фокус — на её карточку в списке
				const card = document.querySelector(
					`[data-modal-open="${CSS.escape(back.id)}"]:not(dialog [data-modal-open])`
				)
				back.addEventListener(
					'modal:closed',
					() => {
						const active = document.activeElement
						// Фокус остался в закрытом окне или потерялся
						if (!active || active === document.body || back.contains(active))
							card?.focus()
					},
					{ once: true, signal }
				)
			})
		},
		{ signal }
	)

	success?.addEventListener('modal:opened', () => (source = null), { signal })

	return () => controller.abort()
}
