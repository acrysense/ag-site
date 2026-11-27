// Картинка не загрузилась (битая ссылка, пустой src) — помечаем классом is-broken, CSS её прячет,
// и под ней видна заготовка блока (миксин image-placeholder) или инициалы аватара. Загрузилась —
// is-loaded: заготовка под ней убирает значок (иначе он просвечивает, когда фото при наведении
// становится прозрачнее). Бэку ничего не нужно. Картинки, добавленные позже (AJAX), ловятся тем
// же слушателем.
const isBroken = (img) => img.getAttribute('src') === '' || (img.complete && !img.naturalWidth)

export function watchBrokenImages() {
	const onEvent = (event) => {
		const img = event.target
		if (!(img instanceof HTMLImageElement)) return
		img.classList.toggle('is-broken', event.type === 'error')
		img.classList.toggle('is-loaded', event.type === 'load')
	}
	document.addEventListener('error', onEvent, true)
	document.addEventListener('load', onEvent, true)
	// Загрузившиеся и упавшие до запуска скрипта. У упавшей снимаем и is-loaded: бэк может вывести
	// фото сразу с is-loaded (аватар в шапке), а файла на сервере нет — иначе инициалы останутся скрыты
	document.querySelectorAll('img').forEach((img) => {
		if (isBroken(img)) {
			img.classList.add('is-broken')
			img.classList.remove('is-loaded')
		} else if (img.complete && img.naturalWidth) img.classList.add('is-loaded')
	})
	return () => {
		document.removeEventListener('error', onEvent, true)
		document.removeEventListener('load', onEvent, true)
	}
}
