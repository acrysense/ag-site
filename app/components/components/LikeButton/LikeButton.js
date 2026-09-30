import { announce } from '@/utils/announce'

const ERROR_TEXT = 'Не удалось сохранить отметку «Нравится». Попробуйте ещё раз.'

// bitrix_sessid: из ядра Битрикса, если оно на странице, иначе из data-sessid кнопки
const sessid = (root) => window.BX?.bitrix_sessid?.() || root.dataset.sessid || ''

export default function init(root) {
	const count = root.querySelector('[data-like-count]')
	const url = root.dataset.likeUrl
	const controller = new AbortController()
	let busy = false

	const render = (liked, value) => {
		root.setAttribute('aria-pressed', String(liked))
		count.textContent = String(value)
		count.hidden = value <= 0
	}

	const onClick = async () => {
		if (busy) return
		const wasLiked = root.getAttribute('aria-pressed') === 'true'
		const before = Number(count.textContent) || 0
		const liked = !wasLiked

		// Сразу показываем результат, при ошибке — откатываем
		render(liked, Math.max(0, before + (liked ? 1 : -1)))
		if (!url) return

		busy = true
		root.setAttribute('aria-busy', 'true')
		try {
			const body = new FormData()
			body.append('liked', liked ? 'Y' : 'N')
			body.append('sessid', sessid(root))
			const response = await fetch(url, {
				method: 'POST',
				body,
				credentials: 'same-origin',
				signal: controller.signal,
			})
			if (!response.ok) throw new Error(`HTTP ${response.status}`)
			const data = await response.json()
			if (typeof data.count === 'number') render(Boolean(data.liked ?? liked), data.count)
		} catch (error) {
			if (error.name === 'AbortError') return
			render(wasLiked, before)
			announce(ERROR_TEXT)
			console.error('[LikeButton]', error)
		} finally {
			busy = false
			root.removeAttribute('aria-busy')
		}
	}

	root.addEventListener('click', onClick)

	return () => {
		root.removeEventListener('click', onClick)
		controller.abort()
	}
}
