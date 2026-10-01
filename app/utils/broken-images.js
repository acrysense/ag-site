// Картинка не загрузилась (битая ссылка, пустой src) — помечаем классом is-broken, CSS её прячет,
// и под ней видна заготовка блока (миксин image-placeholder) или инициалы аватара. Бэку ловить
// ошибку не нужно. Картинки, добавленные позже (AJAX), ловятся тем же слушателем.
const isBroken = (img) => img.getAttribute('src') === '' || (img.complete && !img.naturalWidth)

export function watchBrokenImages() {
	const onEvent = (event) => {
		const img = event.target
		if (!(img instanceof HTMLImageElement)) return
		img.classList.toggle('is-broken', event.type === 'error')
	}
	document.addEventListener('error', onEvent, true)
	document.addEventListener('load', onEvent, true)
	// Упавшие до запуска скрипта
	document
		.querySelectorAll('img')
		.forEach((img) => isBroken(img) && img.classList.add('is-broken'))
	return () => {
		document.removeEventListener('error', onEvent, true)
		document.removeEventListener('load', onEvent, true)
	}
}
