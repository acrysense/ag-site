// Объявление для скринридеров через общую live-область (успех, ошибки без поля формы)
let region

export function announce(message) {
	if (!region) {
		region = document.createElement('div')
		region.className = 'visually-hidden'
		region.setAttribute('role', 'status')
		region.setAttribute('aria-live', 'polite')
		document.body.append(region)
	}
	// Очистка перед записью: повтор той же фразы тоже будет прочитан
	region.textContent = ''
	setTimeout(() => {
		region.textContent = message
	}, 50)
}
