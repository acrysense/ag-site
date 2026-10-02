import { showToast } from '@/utils/toast'

// Тост из разметки: бэк выводит <div hidden data-module="Toast" data-path="components"
// data-toast="ok">Текст</div> — на странице (после действия с перезагрузкой) или в ответе
// AJAX. При монтировании показывается тост с этим текстом, элемент удаляется.
// data-toast: ok, error, info (по умолчанию). Контракт — docs/contracts/toast.md.
export default function init(el) {
	const text = el.textContent.trim()
	const type = el.dataset.toast || 'info'
	el.remove()
	if (text) showToast(text, type)
	return () => {}
}
