import './canvas.scss'

// ?story=<id> — показываем одну историю (так её открывает оболочка ui.html)
const story = new URLSearchParams(window.location.search).get('story')

if (story) {
	document.documentElement.classList.add('is-single-story')
	for (const el of document.querySelectorAll('[data-story]')) {
		el.hidden = el.dataset.story !== story
	}
}
