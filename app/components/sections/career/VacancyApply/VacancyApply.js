// Окно заявки на вакансию: «Откликнуться» (data-vacancy-apply="<id вакансии>",
// data-vacancy-apply-title) подставляет вакансию в скрытое поле и подпись под заголовком.
// Окно вакансии остаётся под заявкой (закрыли заявку — вернулись к вакансии); после отправки
// открывается «Заявка принята», а окно вакансии закрывается — «Вернуться к вакансиям» ведёт
// к списку.
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
	let source = null

	document.addEventListener(
		'click',
		(event) => {
			const trigger = event.target.closest(`[data-modal-open="${CSS.escape(root.id)}"]`)
			if (!trigger || !input) return
			input.value = trigger.dataset.vacancyApply || ''
			subtitle.textContent = trigger.dataset.vacancyApplyTitle || ''
			subtitle.hidden = !subtitle.textContent
			source = trigger.closest('dialog')
			// Новая вакансия — новая исходная точка: подстановка не считается изменением формы
			form?.dispatchEvent(new CustomEvent('form:reset'))
		},
		{ signal }
	)

	success?.addEventListener(
		'modal:opened',
		() => {
			source?.dispatchEvent(new CustomEvent('modal:close'))
			source = null
		},
		{ signal }
	)

	return () => controller.abort()
}
