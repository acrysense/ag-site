import './states.scss'

// ?only=<id> — режим рамки: показываем один блок на всю ширину окна.
// Так iframe шириной 320px проверяет блок с настоящими медиазапросами.
const only = new URLSearchParams(window.location.search).get('only')

if (only) {
	document.documentElement.classList.add('dev-frame')
	for (const block of document.querySelectorAll('[data-dev-block]')) {
		block.hidden = block.dataset.devBlock !== only
	}
}
