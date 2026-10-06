import { createPhotoViewer } from '@/components/components/PhotoViewer/PhotoViewer'

// Фото альбома: сетка, «Показать ещё N фото» и просмотр на весь экран.
// Все фото альбома — JSON в [data-album-photos] (выводит бэк); первые step — разметкой. «Показать
// ещё» дорисовывает следующие step копией первой карточки (та же разметка, что у бэка). Просмотр
// листает весь альбом, «Нравится» в нём и в сетке — одна отметка (синхронизируются).
export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const grid = root.querySelector('[data-album-grid]')
	const more = root.querySelector('[data-album-more]')
	const source = root.querySelector('[data-album-photos]')
	if (!grid || !source) return () => {}

	let photos = []
	try {
		photos = JSON.parse(source.textContent || '[]')
	} catch (error) {
		console.error('[AlbumPhotos] JSON фото не разобран', error)
		return () => {}
	}
	const step = Number(root.dataset.step) || 24
	const template = grid.querySelector('.album-photo')

	// Отметка в сетке → данные просмотра; из просмотра → кнопка в сетке
	const gridLike = (index) =>
		grid
			.querySelector(`[data-photo-index="${index}"]`)
			?.closest('.album-photo')
			?.querySelector('.like-button')

	const viewer = createPhotoViewer({
		title: root.dataset.albumTitle || '',
		items: photos,
		onLike: (index, liked, likes) => {
			const button = gridLike(index)
			if (!button) return
			button.setAttribute('aria-pressed', String(liked))
			const count = button.querySelector('[data-like-count]')
			if (count) {
				count.textContent = String(likes)
				count.hidden = likes <= 0
			}
		},
	})

	const likeObserver = new MutationObserver((records) => {
		for (const record of records) {
			const button = record.target
			const index = Number(
				button.closest('.album-photo')?.querySelector('[data-photo-index]')?.dataset
					.photoIndex
			)
			if (Number.isNaN(index)) continue
			const likes = Number(button.querySelector('[data-like-count]')?.textContent) || 0
			viewer.update(index, { liked: button.getAttribute('aria-pressed') === 'true', likes })
		}
	})
	likeObserver.observe(grid, {
		subtree: true,
		attributes: true,
		attributeFilter: ['aria-pressed'],
	})

	// Карточка фото по данным — копия первой из разметки бэка
	const createItem = (photo, index) => {
		const item = template.cloneNode(true)
		const link = item.querySelector('.album-photo__link')
		link.href = photo.src
		link.dataset.photoIndex = String(index)
		link.setAttribute(
			'aria-label',
			photos.length > 1 ? `Открыть фото ${index + 1} из ${photos.length}` : 'Открыть фото'
		)
		const img = item.querySelector('.album-photo__image')
		img.src = photo.thumb || photo.src
		if (photo.thumbSrcset) img.srcset = photo.thumbSrcset
		else img.removeAttribute('srcset')
		img.alt = photo.alt || ''
		img.classList.remove('is-loaded', 'is-broken')
		const like = item.querySelector('.like-button')
		if (like) {
			like.setAttribute('aria-pressed', String(Boolean(photo.liked)))
			if (photo.likeUrl) like.dataset.likeUrl = photo.likeUrl
			else delete like.dataset.likeUrl
			const count = like.querySelector('[data-like-count]')
			count.textContent = String(photo.likes || 0)
			count.hidden = !photo.likes
		}
		const download = item.querySelector('.album-photo__download')
		if (download) {
			download.hidden = !photo.download
			if (photo.download) download.href = photo.download
			download.setAttribute('aria-label', `Скачать фото ${index + 1}`)
		}
		return item
	}

	const shown = () => grid.querySelectorAll('.album-photo').length
	const renderMore = () => {
		if (!more) return
		const left = photos.length - shown()
		more.hidden = left <= 0
		more.textContent = `Показать ещё ${left} фото`
	}

	more?.addEventListener(
		'click',
		() => {
			const from = shown()
			const items = photos
				.slice(from, from + step)
				.map((photo, i) => createItem(photo, from + i))
			grid.append(...items)
			renderMore()
			// Фокус — на первое новое фото: с клавиатуры продолжить с него
			items[0]?.querySelector('.album-photo__link')?.focus()
		},
		{ signal }
	)

	grid.addEventListener(
		'click',
		(event) => {
			const link = event.target.closest('[data-photo-index]')
			if (!link) return
			event.preventDefault()
			viewer.open(Number(link.dataset.photoIndex) || 0)
		},
		{ signal }
	)

	renderMore()

	return () => {
		controller.abort()
		likeObserver.disconnect()
		viewer.destroy()
	}
}
