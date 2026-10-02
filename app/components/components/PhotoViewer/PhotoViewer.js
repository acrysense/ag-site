import PhotoSwipeLightbox from 'photoswipe/lightbox'
import { createIcon } from '@/utils/icon'
import { lockBody } from '@/utils/scroll-lock'

// Просмотр фото на весь экран (Figma: PC.Gallery — A. Просмотр фото 4682:25854) на PhotoSwipe 5:
// увеличение (два касания, щипок, колесо с Ctrl), свайпы, клавиатура (стрелки, Esc), фокус
// внутри окна и возврат на фото, с которого открыли. Свой вид по макету: сверху название
// альбома, «Фото N из M», «Нравится», «Скачать», крестик; по бокам стрелки; снизу лента
// миниатюр. До 1024 (наше) — без стрелок (свайп), до 768 — и без миниатюр.
// Модуль не монтируется сам — его создаёт блок с фото (sections/gallery/AlbumPhotos).
//
// createPhotoViewer({ title, items, onLike }) → { open(index), update(index, item), destroy() }
// items: [{ src, srcset, width, height, thumb, alt, likes, liked, likeUrl, download }].
// «Нравится» — модуль LikeButton (кнопку монтирует app.js); onLike(index, liked, likes) —
// чтобы блок обновил ту же отметку в сетке.

const DESKTOP = 1024
const TABLET = 768
// Поля вокруг фото — по макету 1920: сверху полоса 92 + 16, снизу миниатюры 64 + 80 + 40, по
// бокам фото шириной до 1400 (стрелки — в оставшихся полях)
function padding({ x }) {
	if (x >= DESKTOP) {
		const side = Math.min(260, Math.max(96, (x - 1400) / 2))
		return { top: 108, bottom: 184, left: side, right: side }
	}
	if (x >= TABLET) return { top: 80, bottom: 112, left: 16, right: 16 }
	return { top: 64, bottom: 16, left: 0, right: 0 }
}

const el = (tag, className, text) => {
	const node = document.createElement(tag)
	if (className) node.className = className
	if (text) node.textContent = text
	return node
}

// Кнопка «Нравится» — разметка components/LikeButton (модуль монтирует app.js)
function likeButton(item) {
	const button = el('button', 'btn like-button photo-viewer__button photo-viewer__like')
	button.type = 'button'
	button.setAttribute('aria-pressed', String(Boolean(item.liked)))
	button.dataset.module = 'LikeButton'
	button.dataset.path = 'components'
	if (item.likeUrl) button.dataset.likeUrl = item.likeUrl
	const off = createIcon('like', 'btn__icon like-button__icon like-button__icon--off')
	const on = createIcon('like-filled', 'btn__icon like-button__icon like-button__icon--on')
	const label = el('span', 'visually-hidden', 'Нравится, ')
	const count = el('span', 'btn__text')
	count.dataset.likeCount = ''
	count.textContent = String(item.likes || 0)
	count.hidden = !item.likes
	button.append(off, on, label, count)
	return button
}

export function createPhotoViewer({ title = '', items = [], onLike = () => {} }) {
	let release = null
	let likeObserver = null

	const lightbox = new PhotoSwipeLightbox({
		dataSource: items.map((item) => ({
			src: item.src,
			srcset: item.srcset || undefined,
			width: item.width,
			height: item.height,
			msrc: item.thumb,
			alt: item.alt || '',
		})),
		pswpModule: () => import('photoswipe'),
		mainClass: 'photo-viewer',
		bgOpacity: 1,
		showHideAnimationType: 'fade',
		arrowPrev: false,
		arrowNext: false,
		close: false,
		zoom: false,
		counter: false,
		imageClickAction: 'zoom',
		tapAction: 'toggle-controls',
		paddingFn: padding,
		errorMsg: 'Не удалось загрузить фото',
	})

	lightbox.on('uiRegister', () => {
		const pswp = lightbox.pswp

		// Верхняя полоса: название, счётчик, «Нравится», «Скачать», крестик
		pswp.ui.registerElement({
			name: 'photo-viewer-bar',
			appendTo: 'root',
			order: 5,
			onInit: (root) => {
				root.classList.add('photo-viewer__bar')
				const head = el('div', 'photo-viewer__head')
				const heading = el('p', 'photo-viewer__title', title)
				const counter = el('p', 'photo-viewer__counter')
				counter.setAttribute('aria-live', 'polite')
				head.append(heading, counter)

				const actions = el('div', 'photo-viewer__actions')
				const likeSlot = el('div', 'photo-viewer__like-slot')
				const download = el('a', 'photo-viewer__button photo-viewer__download')
				download.setAttribute('download', '')
				download.setAttribute('aria-label', 'Скачать фото')
				download.append(createIcon('download', 'photo-viewer__icon'))
				const divider = el('span', 'photo-viewer__divider')
				divider.setAttribute('aria-hidden', 'true')
				const close = el('button', 'photo-viewer__button photo-viewer__close')
				close.type = 'button'
				close.setAttribute('aria-label', 'Закрыть просмотр')
				close.append(createIcon('cross', 'photo-viewer__icon photo-viewer__icon--close'))
				close.addEventListener('click', () => pswp.close())
				actions.append(likeSlot, download, divider, close)
				root.append(head, actions)

				const render = () => {
					const index = pswp.currIndex
					const item = items[index] || {}
					counter.textContent = `Фото ${index + 1} из ${pswp.getNumItems()}`
					download.hidden = !item.download
					if (item.download) download.href = item.download
					// Своя кнопка на каждое фото: LikeButton берёт адрес при монтировании
					likeObserver?.disconnect()
					const button = likeButton(item)
					likeSlot.replaceChildren(button)
					likeObserver = new MutationObserver(() => {
						const liked = button.getAttribute('aria-pressed') === 'true'
						const likes =
							Number(button.querySelector('[data-like-count]')?.textContent) || 0
						item.liked = liked
						item.likes = likes
						onLike(index, liked, likes)
					})
					likeObserver.observe(button, {
						attributes: true,
						attributeFilter: ['aria-pressed'],
					})
				}
				pswp.on('change', render)
				render()
			},
		})

		// Стрелки по бокам (с 1024)
		for (const [name, dir] of [
			['photo-viewer-prev', 'prev'],
			['photo-viewer-next', 'next'],
		]) {
			pswp.ui.registerElement({
				name,
				appendTo: 'root',
				isButton: true,
				order: 6,
				onInit: (button) => {
					button.classList.add('photo-viewer__arrow', `photo-viewer__arrow--${dir}`)
					button.setAttribute(
						'aria-label',
						dir === 'prev' ? 'Предыдущее фото' : 'Следующее фото'
					)
					button.append(createIcon('chevron-right', 'photo-viewer__icon'))
				},
				onClick: () => pswp[dir](),
			})
		}

		// Лента миниатюр (с 768): текущая — рамка Main Blue, остальные приглушены
		pswp.ui.registerElement({
			name: 'photo-viewer-thumbs',
			appendTo: 'root',
			order: 7,
			onInit: (root) => {
				root.classList.add('photo-viewer__thumbs')
				const list = el('div', 'photo-viewer__thumbs-list')
				const buttons = items.map((item, index) => {
					const button = el('button', 'photo-viewer__thumb')
					button.type = 'button'
					button.setAttribute('aria-label', `Фото ${index + 1}`)
					const img = el('img')
					img.src = item.thumb || item.src
					img.alt = ''
					img.loading = 'lazy'
					img.decoding = 'async'
					button.append(img)
					button.addEventListener('click', () => pswp.goTo(index))
					return button
				})
				list.append(...buttons)
				root.append(list)
				const render = () => {
					buttons.forEach((button, index) => {
						const current = index === pswp.currIndex
						button.classList.toggle('is-current', current)
						if (current) button.setAttribute('aria-current', 'true')
						else button.removeAttribute('aria-current')
					})
					const current = buttons[pswp.currIndex]
					if (current) {
						const left =
							current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2
						list.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
					}
				}
				pswp.on('change', render)
				render()
			},
		})
	})

	// Страница под окном не прокручивается (снимаем ровно свою блокировку)
	lightbox.on('openingAnimationStart', () => {
		release?.()
		release = lockBody()
		lightbox.pswp?.element?.setAttribute(
			'aria-label',
			title ? `Фото альбома «${title}»` : 'Фото'
		)
	})
	lightbox.on('destroy', () => {
		likeObserver?.disconnect()
		likeObserver = null
		release?.()
		release = null
	})

	lightbox.init()

	return {
		open: (index) => lightbox.loadAndOpen(index),
		// Отметка изменилась в сетке — данные просмотра те же
		update: (index, patch) => Object.assign(items[index] || {}, patch),
		destroy: () => {
			lightbox.pswp?.close()
			lightbox.destroy()
			likeObserver?.disconnect()
			release?.()
			release = null
		},
	}
}
