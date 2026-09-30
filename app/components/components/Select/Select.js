// Выпадающий список: видимое значение повторяет выбранный пункт нативного <select>.
// С data-select-submit форма отправляется сразу при выборе (фильтры).
export default function init(root) {
	const controller = new AbortController()
	const select = root.querySelector('select')
	const value = root.querySelector('[data-select-value]')
	if (!select || !value) return () => controller.abort()

	const sync = () => {
		value.textContent = select.selectedOptions[0]?.textContent ?? ''
	}

	select.addEventListener(
		'change',
		() => {
			sync()
			if (select.hasAttribute('data-select-submit')) select.form?.requestSubmit()
		},
		{ signal: controller.signal }
	)
	sync()

	return () => controller.abort()
}
