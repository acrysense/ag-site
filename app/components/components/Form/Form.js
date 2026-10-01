import { announce } from '@/utils/announce'

// Отправка формы без перезагрузки (короткие формы: «Предложить тему», отклик на вакансию…).
// - Проверка — при отправке (форма короткая): пустые обязательные, согласие, почта.
//   Ошибка — у поля: цвет, значок, текст, aria-invalid и aria-describedby; фокус на первое.
//   Во время ввода ошибка только снимается, новые не появляются.
// - Отправка: кнопка неактивна, на форме aria-busy, в кнопке значок загрузки, надпись та же.
//   POST FormData с sessid (bitrix_sessid), ответ — JSON (docs/contracts/form.md).
//   Ошибки полей от сервера — к полям, остальное — над кнопкой; ничего не глотается.
// - Успех: data-form-success="<id окна>" — форма закрывается и открывается окно «Спасибо»,
//   иначе сообщение над кнопкой. Результат объявляется скринридеру.
// - Изменённая форма помечается data-form-dirty: модалка перед закрытием спросит. Изменённая —
//   значит отличается от исходной (пробелы по краям не в счёт): написал и стёр — не изменена.
const TEXT = {
	required: 'Заполните поле',
	consent: 'Нужно ваше согласие',
	email: 'Проверьте адрес почты',
	invalid: 'Проверьте поля формы',
	failed: 'Не удалось отправить. Попробуйте ещё раз.',
	sent: 'Отправлено',
}

const TEXT_TYPES = new Set(['text', 'email', 'tel', 'search', 'url'])

const sessid = (form) => window.BX?.bitrix_sessid?.() || form.dataset.sessid || ''

export default function init(form) {
	const controller = new AbortController()
	const { signal } = controller
	const submit = form.querySelector('[type="submit"]')
	const formError = form.querySelector('[data-form-error]')
	let request = null

	form.noValidate = true

	const controls = () =>
		[...form.elements].filter(
			(el) => el.name && !['submit', 'button', 'hidden', 'reset'].includes(el.type)
		)

	const errorBox = (el) => (el.id ? form.querySelector(`#${CSS.escape(el.id)}-error`) : null)
	const wrapper = (el) => el.closest('.field, .checkbox')

	const setError = (el, message) => {
		const box = errorBox(el)
		el.setAttribute('aria-invalid', 'true')
		wrapper(el)?.classList.add('is-invalid')
		if (!box) return
		box.querySelector('[data-field-error]').textContent = message
		box.hidden = false
		const ids = new Set((el.getAttribute('aria-describedby') || '').split(' ').filter(Boolean))
		ids.add(box.id)
		el.setAttribute('aria-describedby', [...ids].join(' '))
	}

	const clearError = (el) => {
		const box = errorBox(el)
		el.removeAttribute('aria-invalid')
		wrapper(el)?.classList.remove('is-invalid')
		if (!box) return
		box.hidden = true
		box.querySelector('[data-field-error]').textContent = ''
		const ids = (el.getAttribute('aria-describedby') || '')
			.split(' ')
			.filter((id) => id && id !== box.id)
		if (ids.length) el.setAttribute('aria-describedby', ids.join(' '))
		else el.removeAttribute('aria-describedby')
	}

	const setFormError = (message) => {
		if (!formError) return
		formError.textContent = message || ''
		formError.hidden = !message
	}

	// Чистка текста: пробелы по краям и в концах строк, не больше одной пустой строки подряд.
	// Длину ограничивает maxlength; бэк проверяет то же самое (фронт можно обойти)
	const normalize = (el) => {
		if (!(
			el instanceof HTMLTextAreaElement ||
			(el instanceof HTMLInputElement && TEXT_TYPES.has(el.type))
		))
			return
		const clean = el.value
			.replace(/\r\n?/g, '\n')
			.replace(/[ \t]+\n/g, '\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim()
		if (clean !== el.value) {
			el.value = clean
			el.dispatchEvent(new Event('input', { bubbles: true }))
		}
	}

	const check = (el) => {
		if (el.type === 'checkbox') return el.required && !el.checked ? TEXT.consent : ''
		const value = el.value.trim()
		if (el.required && !value) return TEXT.required
		if (el.type === 'email' && value && el.validity.typeMismatch) return TEXT.email
		return ''
	}

	const clearAll = () => {
		controls().forEach(clearError)
		setFormError('')
	}

	// Значения формы для сравнения с исходными (без служебных полей)
	const snapshot = () =>
		[...new FormData(form)]
			.filter(([name, value]) => name !== 'sessid' && typeof value === 'string')
			.map(([name, value]) => `${name}=${value.trim()}`)
			.join('&')
	let initial = snapshot()
	const updateDirty = () => form.toggleAttribute('data-form-dirty', snapshot() !== initial)

	const setBusy = (busy) => {
		form.toggleAttribute('aria-busy', busy)
		if (busy) form.setAttribute('aria-busy', 'true')
		if (!submit) return
		submit.disabled = busy
		submit.classList.toggle('is-loading', busy)
	}

	const succeed = (message) => {
		form.reset()
		initial = snapshot()
		form.removeAttribute('data-form-dirty')
		clearAll()
		const target = form.dataset.formSuccess
		if (target && document.getElementById(target)) {
			form.closest('dialog')?.dispatchEvent(new CustomEvent('modal:close'))
			document.getElementById(target).dispatchEvent(new CustomEvent('modal:open'))
		} else setFormError(message || TEXT.sent)
		announce(message || TEXT.sent)
	}

	form.addEventListener(
		'submit',
		async (event) => {
			event.preventDefault()
			if (request) return
			setFormError('')

			controls().forEach(normalize)
			const invalid = []
			for (const el of controls()) {
				const message = check(el)
				if (message) {
					setError(el, message)
					invalid.push(el)
				} else clearError(el)
			}
			if (invalid.length) {
				invalid[0].focus()
				announce(TEXT.invalid)
				return
			}

			const body = new FormData(form)
			if (!body.has('sessid')) body.append('sessid', sessid(form))
			const own = new AbortController()
			request = own
			setBusy(true)
			try {
				const response = await fetch(form.action, {
					method: 'POST',
					body,
					headers: { Accept: 'application/json' },
					credentials: 'same-origin',
					signal: own.signal,
				})
				const data = await response.json().catch(() => ({}))
				if (signal.aborted) return
				if (response.ok && data.ok !== false) {
					succeed(data.message)
					return
				}
				// Ошибки полей — к полям; неизвестные поля и общая ошибка — над кнопкой
				const errors = data.errors && typeof data.errors === 'object' ? data.errors : {}
				const rest = []
				let first = null
				for (const [name, message] of Object.entries(errors)) {
					const el = form.elements.namedItem(name)
					if (el && el instanceof Element) {
						setError(el, String(message))
						first ||= el
					} else rest.push(String(message))
				}
				const general =
					[data.message, ...rest].filter(Boolean).join(' ') || (first ? '' : TEXT.failed)
				setFormError(general)
				first?.focus()
				announce(general || TEXT.invalid)
			} catch (error) {
				if (signal.aborted || own.signal.aborted) return
				setFormError(TEXT.failed)
				announce(TEXT.failed)
			} finally {
				if (request === own) request = null
				if (!signal.aborted) setBusy(false)
			}
		},
		{ signal }
	)

	// Ввод: помечаем форму изменённой; исправленное поле — без ошибки (новых не добавляем)
	const onInput = (event) => {
		const el = event.target
		if (!el.name) return
		updateDirty()
		if (el.getAttribute('aria-invalid') === 'true' && !check(el)) clearError(el)
	}
	form.addEventListener('input', onInput, { signal })
	form.addEventListener('change', onInput, { signal })
	form.addEventListener(
		'form:reset',
		() => {
			initial = snapshot()
			clearAll()
		},
		{ signal }
	)
	form.addEventListener('focusout', (event) => normalize(event.target), { signal })

	return () => {
		controller.abort()
		request?.abort()
	}
}
