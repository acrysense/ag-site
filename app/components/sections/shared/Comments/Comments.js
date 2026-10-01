import { announce } from '@/utils/announce'
import { createIcon as icon } from '@/utils/icon'

// Комментарии: дерево с ответами, реакциями (👍/👎 — они же голос), модерацией.
// Контракт API — docs/contracts/comments.md (он же вкладка «Для бэкенда» прототипа в ag).
//
// Нагрузка на бэк: первая порция — из страницы (data-comments-initial) или одним запросом,
// когда блок подошёл к экрану; дальше — порциями по курсору (верхний уровень — по кнопке,
// ответы — «Показать ещё N ответов»). Дерево целиком не запрашивается никогда.
// Реакции — сразу на экране (оптимистично), при ошибке откатываются.
// Права и модерацию решает бэк: фронт только показывает флаги (canEdit, canDelete,
// commentsEnabled, status). Текст пользователей — только через textContent.
const REACTIONS = [
	['like', '👍', 'Нравится'],
	['smile', '😀', 'Смешно'],
	['clap', '👏', 'Браво'],
	['heart', '❤️', 'Люблю'],
	['party', '🎉', 'Праздник'],
	['hmm', '🫤', 'Сомневаюсь'],
	['dislike', '👎', 'Не нравится'],
]
const REPLY_PAGE = 20
// Как в ag (utils/comment-limits.js): длина и число переносов; бэк проверяет то же
const MAX_LENGTH = 500
const MAX_BREAKS = 10

const plural = (n, one, few, many) => {
	const mod10 = n % 10
	const mod100 = n % 100
	if (mod10 === 1 && mod100 !== 11) return one
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
	return many
}

const relativeTime = (iso) => {
	const date = new Date(iso)
	const diff = Math.max(0, (Date.now() - date.getTime()) / 1000)
	if (diff < 60) return 'только что'
	if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
	if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
	if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн назад`
	return date.toLocaleDateString('ru-RU')
}

const fullDate = (iso) =>
	new Date(iso).toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short' })

// Небольшой помощник разметки: h('div', { class: 'x', text: '…' }, ...дети)
const h = (tag, attrs = {}, ...children) => {
	const el = document.createElement(tag)
	for (const [key, value] of Object.entries(attrs)) {
		if (value === undefined || value === null || value === false) continue
		if (key === 'class') el.className = value
		else if (key === 'text') el.textContent = value
		else if (key === 'hidden') el.hidden = Boolean(value)
		else el.setAttribute(key, value === true ? '' : value)
	}
	el.append(...children.filter(Boolean))
	return el
}

const sessid = () => window.BX?.bitrix_sessid?.() || ''

export default function init(root) {
	const controller = new AbortController()
	const { signal } = controller
	const apiUrl = root.dataset.commentsUrl
	const entity = root.dataset.entity || ''
	const entityId = root.dataset.entityId || ''
	const limit = Number(root.dataset.limit) || 8
	const list = root.querySelector('[data-comments-list]')
	const composerHost = root.querySelector('[data-comments-composer]')
	const countEl = root.querySelector('[data-comments-count]')
	const statusEl = root.querySelector('[data-comments-status]')
	const moreButton = root.querySelector('[data-comments-more]')
	const pending = new Set()
	const timers = new Set() // подсветка новых
	const nodes = new Map() // id → { data, el }
	let state = {
		currentUser: null,
		enabled: true,
		minLength: 10,
		maxLength: MAX_LENGTH,
		nextCursor: null,
		total: 0,
	}
	let loaded = false
	let popover = null // открытая панель: { el, anchor, close }
	let timeTimer = 0
	let observer = null
	let uid = 0

	const canWrite = () => Boolean(state.currentUser) && state.enabled

	// ---------- Сеть ----------

	const request = async (url, options = {}) => {
		const own = new AbortController()
		pending.add(own)
		try {
			const response = await fetch(url, {
				credentials: 'same-origin',
				...options,
				signal: own.signal,
				headers: { Accept: 'application/json', ...(options.headers || {}) },
			})
			const data = await response.json().catch(() => ({}))
			if (!response.ok || data.ok === false) {
				const error = new Error(data.message || `HTTP ${response.status}`)
				error.data = data
				throw error
			}
			return data
		} finally {
			pending.delete(own)
		}
	}

	const getPage = ({ parent = 0, cursor = '', size = limit } = {}) => {
		const url = new URL(apiUrl, window.location.href)
		url.searchParams.set('entity', entity)
		url.searchParams.set('entityId', entityId)
		url.searchParams.set('parent', String(parent))
		url.searchParams.set('sort', 'new')
		url.searchParams.set('limit', String(size))
		if (cursor) url.searchParams.set('cursor', cursor)
		return request(url)
	}

	const post = (action, payload) => {
		const url = new URL(apiUrl, window.location.href)
		url.searchParams.set('action', action)
		const token = sessid()
		return request(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(token ? { 'X-Bitrix-Csrf-Token': token } : {}),
			},
			body: JSON.stringify({ ...payload, sessid: token }),
		})
	}

	// ---------- Общие куски ----------

	const setCount = (value) => {
		state.total = Math.max(0, value)
		countEl.textContent = state.total ? String(state.total) : ''
	}

	const showStatus = (text, retry) => {
		statusEl.replaceChildren()
		statusEl.hidden = !text
		if (!text) return
		statusEl.append(text)
		if (retry) {
			const button = h('button', {
				class: 'comments__retry',
				type: 'button',
				text: 'Повторить',
			})
			button.addEventListener('click', retry, { signal })
			statusEl.append(' ', button)
		}
	}

	const flash = (el) => {
		el.classList.add('is-new')
		const timer = setTimeout(() => {
			timers.delete(timer)
			el.classList.remove('is-new')
		}, 700)
		timers.add(timer)
	}

	// Всплывающие панели (реакции, меню, удаление): одна за раз, закрываются кликом вне и Esc,
	// не выходят за край экрана
	const closePopover = ({ focus = false } = {}) => {
		if (!popover) return
		const { el, anchor } = popover
		popover = null
		el.remove()
		anchor.setAttribute('aria-expanded', 'false')
		anchor.classList.remove('is-active')
		if (focus) anchor.focus()
	}

	// Панель — у своей кнопки: реакции над ней, меню и удаление под ней, от левого края кнопки
	// (Figma 4502:1218, 4518:1781, 4518:1964); у края экрана сдвигается внутрь.
	// Фокус внутрь — только если открыли с клавиатуры (мышью — без рамки фокуса на пункте)
	const openPopover = (anchor, el, host, { above = false, keyboard = false } = {}) => {
		const same = popover?.anchor === anchor
		closePopover()
		if (same) return
		el.style.left = `${anchor.offsetLeft}px`
		if (above) el.style.bottom = `${host.clientHeight - anchor.offsetTop + 6}px`
		else el.style.top = `${anchor.offsetTop + anchor.offsetHeight + 6}px`
		host.append(el)
		anchor.setAttribute('aria-expanded', 'true')
		anchor.classList.add('is-active')
		popover = { el, anchor }
		const rect = el.getBoundingClientRect()
		const overflow = rect.right - (document.documentElement.clientWidth - 8)
		if (overflow > 0) el.style.translate = `${-Math.min(overflow, rect.left - 8)}px 0`
		if (keyboard) el.querySelector('button')?.focus()
	}

	document.addEventListener(
		'pointerdown',
		(event) => {
			if (
				popover &&
				!popover.el.contains(event.target) &&
				!popover.anchor.contains(event.target)
			)
				closePopover()
		},
		{ signal }
	)
	root.addEventListener(
		'keydown',
		(event) => {
			if (event.key === 'Escape' && popover) {
				event.preventDefault()
				closePopover({ focus: true })
			}
		},
		{ signal }
	)

	// ---------- Поле ввода (новый комментарий, ответ, правка) ----------

	const hintText = (length) => {
		if (!length) return { text: `Минимум ${state.minLength} символов`, error: false }
		if (length < state.minLength) {
			const left = state.minLength - length
			return {
				text: `Ещё ${left} ${plural(left, 'символ', 'символа', 'символов')}`,
				error: true,
			}
		}
		return { text: '', error: false }
	}

	// Чистка как в Form: пробелы в концах строк, не больше одной пустой строки подряд;
	// переносов не больше MAX_BREAKS — остальные становятся пробелами
	const normalize = (value) => {
		const clean = value
			.replace(/\r\n?/g, '\n')
			.replace(/[ \t]+\n/g, '\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim()
		let breaks = 0
		return clean.replace(/\n/g, () => (++breaks > MAX_BREAKS ? ' ' : '\n'))
	}

	// mode: 'new' | 'reply' | 'edit'. onSubmit(text) → Promise
	const createForm = ({ mode, placeholder, submitText, value = '', onSubmit, onCancel }) => {
		const id = `comment-form-${++uid}`
		const input = h('textarea', {
			class: 'comment-form__input',
			id,
			rows: 1,
			maxlength: state.maxLength,
			placeholder,
			'aria-label': placeholder,
			'aria-describedby': `${id}-hint`,
			'data-autosize': true,
			'data-autosize-max-rows': 11,
		})
		input.value = value
		const submit = h('button', {
			class: 'btn btn--general btn--s comment-form__submit',
			type: 'submit',
			text: submitText,
		})
		const hint = h('p', {
			class: 'comment-form__hint',
			id: `${id}-hint`,
			'aria-live': 'polite',
		})
		const field = h('div', { class: 'comment-form__field' }, input)
		const form = h('form', { class: `comment-form comment-form--${mode}`, novalidate: true })

		if (mode === 'edit') {
			const cancel = h('button', {
				class: 'btn btn--light btn--s comment-form__cancel',
				type: 'button',
				text: 'Отмена',
			})
			cancel.addEventListener('click', () => onCancel?.(), { signal })
			hint.textContent = 'Esc — отменить'
			form.append(field, h('div', { class: 'comment-form__buttons' }, hint, cancel, submit))
		} else {
			field.append(submit)
			form.append(field, hint)
		}

		let failed = false
		const update = () => {
			if (mode === 'edit') return
			const { text, error } = hintText(normalize(input.value).length)
			hint.textContent =
				failed && text ? `Нужно минимум ${state.minLength} символов, чтобы отправить` : text
			hint.hidden = !hint.textContent
			form.classList.toggle('is-counting', error && !failed)
			if (!error) failed = false
			form.classList.toggle('is-error', failed)
			input.toggleAttribute('aria-invalid', failed)
		}
		update()

		// Высота растёт с текстом (utils/autosize по data-autosize), дальше текст не вводится
		input.addEventListener('input', update, { signal })
		input.addEventListener(
			'keydown',
			(event) => {
				if (event.key === 'Escape' && mode !== 'new') {
					event.stopPropagation()
					onCancel?.()
				}
				// Ctrl/Cmd + Enter — отправить
				if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) form.requestSubmit()
			},
			{ signal }
		)

		form.addEventListener(
			'submit',
			async (event) => {
				event.preventDefault()
				if (form.getAttribute('aria-busy') === 'true') return
				const text = normalize(input.value)
				if (text.length < state.minLength) {
					failed = true
					update()
					input.focus()
					return
				}
				form.setAttribute('aria-busy', 'true')
				submit.disabled = true
				const label = submit.textContent
				submit.textContent = mode === 'edit' ? 'Сохранение' : 'Отправка'
				input.readOnly = true
				try {
					await onSubmit(text)
					input.value = ''
					input.dispatchEvent(new Event('input'))
				} catch (error) {
					hint.hidden = false
					hint.textContent =
						error?.data?.message || 'Не удалось отправить. Попробуйте ещё раз.'
					form.classList.add('is-error')
					announce(hint.textContent)
				} finally {
					if (!signal.aborted) {
						form.removeAttribute('aria-busy')
						submit.disabled = false
						submit.textContent = label
						input.readOnly = false
					}
				}
			},
			{ signal }
		)

		return { form, input }
	}

	// ---------- Комментарий ----------

	const reactionLabel = (type) => REACTIONS.find(([t]) => t === type)?.[2] || type

	const renderReactions = (node) => {
		const { data, reactionsEl } = node
		const mine = new Set(data.myReactions || [])
		const pills = REACTIONS.filter(([type]) => (data.reactions?.[type] || 0) > 0).map(
			([type, emoji, label]) => {
				const count = data.reactions[type]
				const isMine = mine.has(type)
				const pill = h(
					'button',
					{
						class: `comment__reaction${isMine ? ' is-mine' : ''}${isMine && type === 'dislike' ? ' is-dislike' : ''}`,
						type: 'button',
						'data-reaction': type,
						'aria-pressed': String(isMine),
						'aria-label': `${label}: ${count}`,
						disabled: !canWrite() || data.deleted,
					},
					h('span', { 'aria-hidden': 'true', text: emoji }),
					h('span', {
						class: 'comment__reaction-count',
						'aria-hidden': 'true',
						text: String(count),
					})
				)
				return pill
			}
		)
		reactionsEl.replaceChildren(...pills)
		// Рейтинг = 👍 − 👎: зелёный «+N», красный «−N», при 0 скрыт
		const score = data.score ?? (data.reactions?.like || 0) - (data.reactions?.dislike || 0)
		node.scoreEl.hidden = !score || data.deleted
		node.scoreEl.textContent = score > 0 ? `+${score}` : `−${Math.abs(score)}`
		node.scoreEl.classList.toggle('is-negative', score < 0)
	}

	const react = async (node, type) => {
		const { data } = node
		const before = {
			reactions: { ...(data.reactions || {}) },
			myReactions: [...(data.myReactions || [])],
			score: data.score,
		}
		const mine = new Set(data.myReactions || [])
		const has = mine.has(type)
		data.reactions = { ...(data.reactions || {}) }
		data.reactions[type] = Math.max(0, (data.reactions[type] || 0) + (has ? -1 : 1))
		if (has) mine.delete(type)
		else mine.add(type)
		data.myReactions = [...mine]
		data.score = (data.reactions.like || 0) - (data.reactions.dislike || 0)
		renderReactions(node)
		try {
			const result = await post('react', { commentId: data.id, type })
			if (signal.aborted) return
			Object.assign(data, {
				reactions: result.reactions ?? data.reactions,
				myReactions: result.myReactions ?? data.myReactions,
				score: result.score ?? data.score,
			})
			renderReactions(node)
		} catch {
			if (signal.aborted) return
			Object.assign(data, before)
			renderReactions(node)
			announce('Не удалось поставить реакцию')
		}
	}

	const openPicker = (node, anchor, keyboard) => {
		const mine = new Set(node.data.myReactions || [])
		const picker = h('div', {
			class: 'comment__picker',
			role: 'group',
			'aria-label': 'Выбор реакции',
		})
		for (const [type, emoji, label] of REACTIONS) {
			const option = h('button', {
				class: 'comment__picker-option',
				type: 'button',
				'aria-label': label,
				'aria-pressed': String(mine.has(type)),
				text: emoji,
			})
			option.addEventListener(
				'click',
				() => {
					closePopover({ focus: true })
					react(node, type)
				},
				{ signal }
			)
			picker.append(option)
		}
		// Стрелки влево и вправо — по реакциям
		picker.addEventListener(
			'keydown',
			(event) => {
				if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
				event.preventDefault()
				const buttons = [...picker.querySelectorAll('button')]
				const index = buttons.indexOf(document.activeElement)
				const next = {
					ArrowLeft: (index - 1 + buttons.length) % buttons.length,
					ArrowRight: (index + 1) % buttons.length,
					Home: 0,
					End: buttons.length - 1,
				}[event.key]
				buttons[next].focus()
			},
			{ signal }
		)
		openPopover(anchor, picker, node.actionsEl, { above: true, keyboard })
	}

	const openMenu = (node, anchor, keyboard) => {
		const menu = h('div', {
			class: 'comment__menu',
			role: 'menu',
			'aria-label': 'Модерация комментария',
		})
		if (node.data.canEdit && !node.data.deleted) {
			const edit = h(
				'button',
				{ class: 'comment__menu-item', type: 'button', role: 'menuitem' },
				icon('edit', 'comment__menu-icon'),
				'Редактировать'
			)
			edit.addEventListener(
				'click',
				() => {
					closePopover()
					startEdit(node)
				},
				{ signal }
			)
			menu.append(edit)
		}
		if (node.data.canDelete && !node.data.deleted) {
			const remove = h(
				'button',
				{
					class: 'comment__menu-item comment__menu-item--danger',
					type: 'button',
					role: 'menuitem',
				},
				icon('trash', 'comment__menu-icon'),
				'Удалить'
			)
			remove.addEventListener(
				'click',
				() => {
					closePopover()
					confirmDelete(node, anchor)
				},
				{ signal }
			)
			menu.append(remove)
		}
		menu.addEventListener(
			'keydown',
			(event) => {
				if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
				event.preventDefault()
				const items = [...menu.querySelectorAll('button')]
				const index = items.indexOf(document.activeElement)
				items[
					(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
				].focus()
			},
			{ signal }
		)
		openPopover(anchor, menu, node.actionsEl, { keyboard })
	}

	const confirmDelete = (node, anchor) => {
		const titleId = `comment-delete-${++uid}`
		const cancel = h('button', {
			class: 'btn btn--light btn--s comment__confirm-cancel',
			type: 'button',
			text: 'Отмена',
		})
		const remove = h('button', {
			class: 'btn btn--error btn--s comment__confirm-delete',
			type: 'button',
			text: 'Удалить',
		})
		const box = h(
			'div',
			{ class: 'comment__confirm', role: 'alertdialog', 'aria-labelledby': titleId },
			h('p', { class: 'comment__confirm-title', id: titleId, text: 'Удалить комментарий?' }),
			h('p', {
				class: 'comment__confirm-text',
				text: 'Действие нельзя отменить. Если у комментария есть ответы, они останутся в ветке.',
			}),
			h('div', { class: 'comment__confirm-buttons' }, cancel, remove)
		)
		cancel.addEventListener('click', () => closePopover({ focus: true }), { signal })
		remove.addEventListener(
			'click',
			async () => {
				remove.disabled = true
				try {
					const result = await post('delete', { commentId: node.data.id })
					if (signal.aborted) return
					closePopover()
					// С ответами — заглушка на месте (ветка остаётся), без ответов — убираем
					const keep = result.mode
						? result.mode === 'placeholder'
						: node.data.replyCount > 0
					if (keep) markDeleted(node)
					else removeNode(node)
					announce('Комментарий удалён')
				} catch {
					remove.disabled = false
					announce('Не удалось удалить комментарий')
				}
			},
			{ signal }
		)
		// Подтверждение — всегда с фокусом на «Отмена» (alertdialog)
		openPopover(anchor, box, node.actionsEl, { keyboard: true })
	}

	const markDeleted = (node) => {
		node.data = { ...node.data, deleted: true, text: '' }
		node.el.classList.add('is-deleted')
		node.nameEl.replaceWith(
			h('span', { class: 'comment__deleted', text: 'Комментарий удалён администратором' })
		)
		node.roleEl?.remove()
		node.scoreEl.hidden = true
		node.replyForm?.remove()
		node.textEl.remove()
		node.actionsEl.remove()
	}

	const removeNode = (node) => {
		const parent = nodes.get(node.data.parentId)
		;(node.el.parentElement?.classList.contains('comment__branch')
			? node.el.parentElement
			: node.el
		).remove()
		nodes.delete(node.data.id)
		setCount(state.total - 1)
		if (!parent) {
			renderEmpty()
			return
		}
		parent.data.replyCount = Math.max(0, (parent.data.replyCount || 0) - 1)
		if (!parent.repliesEl.querySelector('.comment') && !parent.data.replyCount)
			removeRail(parent)
	}

	const startEdit = (node) => {
		if (node.editing) return
		node.editing = true
		const { textEl } = node
		const restore = () => {
			node.editing = false
			form.remove()
			textEl.hidden = false
			node.actionsEl.hidden = false
			node.actionsEl.querySelector('.comment__more')?.focus()
		}
		const { form, input } = createForm({
			mode: 'edit',
			placeholder: 'Текст комментария',
			submitText: 'Сохранить',
			value: node.data.text,
			onCancel: restore,
			onSubmit: async (text) => {
				const result = await post('edit', { commentId: node.data.id, text })
				if (signal.aborted) return
				node.data = {
					...node.data,
					...(result.comment || {}),
					text: result.comment?.text ?? text,
					edited: true,
				}
				textEl.textContent = node.data.text
				node.editedEl.hidden = false
				restore()
				announce('Комментарий изменён')
			},
		})
		form.classList.add('comment__edit')
		textEl.hidden = true
		node.actionsEl.hidden = true
		textEl.after(form)
		input.focus()
		input.setSelectionRange(input.value.length, input.value.length)
	}

	const toggleReply = (node, anchor) => {
		if (node.replyForm) {
			node.replyForm.remove()
			node.replyForm = null
			anchor.setAttribute('aria-expanded', 'false')
			return
		}
		const name = node.data.author?.name || ''
		const { form, input } = createForm({
			mode: 'reply',
			placeholder: name ? `Ответить ${name}` : 'Ваш ответ',
			submitText: 'Ответить',
			onCancel: () => toggleReply(node, anchor),
			onSubmit: async (text) => {
				const result = await post('create', {
					entity,
					entityId,
					parentId: node.data.id,
					text,
				})
				if (signal.aborted) return
				addReply(node, result.comment)
				toggleReply(node, anchor)
				anchor.focus()
			},
		})
		node.replyForm = form
		node.contentEl.append(form)
		anchor.setAttribute('aria-expanded', 'true')
		input.focus()
	}

	// Ответ: первым в ветке, с подсветкой. Первый ответ — у родителя появляются линия и кнопка
	const addReply = (parent, comment) => {
		if (!comment) return
		parent.data.replyCount = (parent.data.replyCount || 0) + 1
		ensureRail(parent)
		const branch = renderBranch(comment, parent.depth + 1)
		parent.repliesEl.prepend(branch)
		parent.repliesEl.hidden = false
		setCollapsed(parent, false)
		setCount(state.total + 1)
		flash(branch.querySelector('.comment'))
		announce(
			comment.status === 'pending' ? 'Ответ отправлен на модерацию' : 'Ответ опубликован'
		)
	}

	const setCollapsed = (node, collapsed) => {
		if (!node.collapseButton) return
		node.repliesEl.hidden = collapsed
		node.collapseButton.setAttribute('aria-expanded', String(!collapsed))
		const label = collapsed ? 'Развернуть ответы' : 'Свернуть ответы'
		node.collapseButton.setAttribute('aria-label', label)
		node.collapseButton.title = label
		node.collapseButton.replaceChildren(
			icon(collapsed ? 'expand' : 'collapse', 'comment__collapse-icon')
		)
		node.el.classList.toggle('is-collapsed', collapsed)
	}

	const removeRail = (node) => {
		node.railEl.replaceChildren()
		node.collapseButton = null
		node.repliesEl.hidden = true
		node.el.classList.remove('has-replies', 'is-collapsed')
	}

	const ensureRail = (node) => {
		if (node.collapseButton) return
		const button = h('button', {
			class: 'comment__collapse',
			type: 'button',
			'aria-controls': node.repliesEl.id,
		})
		button.addEventListener(
			'click',
			() => setCollapsed(node, button.getAttribute('aria-expanded') === 'true'),
			{ signal }
		)
		node.railEl.append(
			h('span', { class: 'comment__rail-line' }),
			button,
			h('span', { class: 'comment__rail-end' })
		)
		node.collapseButton = button
		node.el.classList.add('has-replies')
		setCollapsed(node, false)
	}

	const shownReplies = (node) =>
		node.repliesEl.querySelectorAll(':scope > .comment__branch:not(.comment__branch--more)')
			.length

	// «Показать ещё N ответов» — по 20, пока есть
	const renderLoadReplies = (node) => {
		node.loadRepliesEl?.remove()
		node.loadRepliesEl = null
		const shown = shownReplies(node)
		const left = (node.data.replyCount || 0) - shown
		if (left <= 0) return
		const button = h('button', {
			class: 'btn comment__load-replies',
			type: 'button',
			text: `Показать ещё ${left} ${plural(left, 'ответ', 'ответа', 'ответов')}`,
		})
		button.addEventListener(
			'click',
			async () => {
				button.disabled = true
				button.classList.add('is-loading')
				button.textContent = 'Загрузка'
				try {
					const page = await getPage({
						parent: node.data.id,
						cursor: node.repliesCursor || '',
						size: REPLY_PAGE,
					})
					if (signal.aborted) return
					for (const reply of page.items || []) {
						if (nodes.has(reply.id)) continue
						node.repliesEl.insertBefore(renderBranch(reply, node.depth + 1), branchWrap)
					}
					node.repliesCursor = page.nextCursor || null
					if (!page.nextCursor) node.data.replyCount = shownReplies(node)
					renderLoadReplies(node)
				} catch {
					button.disabled = false
					button.classList.remove('is-loading')
					button.textContent = 'Не удалось загрузить. Повторить'
				}
			},
			{ signal }
		)
		const branchWrap = h(
			'div',
			{ class: 'comment__branch comment__branch--more' },
			h('span', { class: 'comment__connector' }),
			button
		)
		node.repliesEl.append(branchWrap)
		node.loadRepliesEl = branchWrap
	}

	const renderBranch = (comment, depth) =>
		h(
			'div',
			{ class: 'comment__branch' },
			h('span', { class: 'comment__connector' }),
			renderComment(comment, depth)
		)

	const renderComment = (data, depth = 0) => {
		const node = { data, depth }
		const repliesId = `comment-replies-${data.id}`
		const time = h('time', {
			class: 'comment__time',
			datetime: data.createdAt,
			title: fullDate(data.createdAt),
			text: relativeTime(data.createdAt),
		})
		const author = data.author || {}
		const avatar = author.avatar
			? h('img', {
					class: 'comment__avatar',
					src: author.avatar,
					width: 30,
					height: 30,
					alt: '',
					loading: 'lazy',
				})
			: h('span', { class: 'comment__avatar', 'aria-hidden': 'true' })
		node.scoreEl = h('span', { class: 'comment__score' })
		node.editedEl = h('span', {
			class: 'comment__edited',
			text: 'изменено',
			hidden: !data.edited,
		})
		node.nameEl = data.deleted
			? h('span', { class: 'comment__deleted', text: 'Комментарий удалён администратором' })
			: author.url
				? h('a', { class: 'comment__name', href: author.url, text: author.name || '' })
				: h('span', { class: 'comment__name', text: author.name || '' })
		node.roleEl =
			!data.deleted && author.role
				? h('span', { class: 'comment__role', text: author.role })
				: null
		const meta = h(
			'div',
			{ class: 'comment__meta' },
			node.nameEl,
			node.roleEl,
			time,
			node.scoreEl,
			node.editedEl,
			data.status === 'pending'
				? h('span', { class: 'comment__pending', text: 'на модерации' })
				: null
		)
		node.textEl = h('p', { class: 'comment__text', text: data.deleted ? '' : data.text || '' })
		node.reactionsEl = h('div', { class: 'comment__reactions' })
		node.actionsEl = h('div', { class: 'comment__actions' }, node.reactionsEl)

		if (!data.deleted && canWrite()) {
			const addReaction = h(
				'button',
				{
					class: 'comment__add-reaction',
					type: 'button',
					'aria-haspopup': 'true',
					'aria-expanded': 'false',
				},
				icon('plus-small', 'comment__plus'),
				'Реакция'
			)
			// detail 0 — нажатие с клавиатуры (Enter, пробел)
			addReaction.addEventListener(
				'click',
				(event) => openPicker(node, addReaction, event.detail === 0),
				{ signal }
			)
			const reply = h('button', {
				class: 'comment__reply',
				type: 'button',
				'aria-expanded': 'false',
				text: 'Ответить',
			})
			reply.addEventListener('click', () => toggleReply(node, reply), { signal })
			node.actionsEl.append(addReaction, reply)
		}
		if (!data.deleted && (data.canEdit || data.canDelete)) {
			const more = h(
				'button',
				{
					class: 'comment__more',
					type: 'button',
					'aria-haspopup': 'menu',
					'aria-expanded': 'false',
					'aria-label': 'Модерация комментария',
				},
				icon('more', 'comment__more-icon')
			)
			more.addEventListener('click', (event) => openMenu(node, more, event.detail === 0), {
				signal,
			})
			node.actionsEl.append(more)
		}

		node.contentEl = h(
			'div',
			{ class: 'comment__content' },
			data.deleted ? null : node.textEl,
			data.deleted ? null : node.actionsEl
		)
		node.railEl = h('div', { class: 'comment__rail' })
		node.repliesEl = h('div', { class: 'comment__replies', id: repliesId })
		node.el = h(
			'article',
			{
				class: `comment${data.deleted ? ' is-deleted' : ''}`,
				'data-id': data.id,
				'data-depth': depth,
			},
			h('div', { class: 'comment__head' }, avatar, meta),
			h('div', { class: 'comment__body' }, node.railEl, node.contentEl),
			node.repliesEl
		)
		nodes.set(data.id, node)
		renderReactions(node)

		const replies = data.replies || []
		for (const reply of replies) node.repliesEl.append(renderBranch(reply, depth + 1))
		node.repliesCursor = data.repliesCursor || null
		if ((data.replyCount || 0) > 0 || replies.length) ensureRail(node)
		renderLoadReplies(node)
		return node.el
	}

	// ---------- Лента ----------

	const renderMore = () => {
		moreButton.hidden = !state.nextCursor
	}

	const applyPage = (page, { append }) => {
		state.currentUser = page.currentUser ?? state.currentUser
		state.enabled = page.commentsEnabled ?? state.enabled
		state.minLength = page.minLength ?? state.minLength
		state.maxLength = page.maxLength ?? state.maxLength
		state.nextCursor = page.nextCursor || null
		if (page.total !== undefined) setCount(page.total)
		const items = (page.items || []).filter((item) => !nodes.has(item.id))
		const fragment = document.createDocumentFragment()
		items.forEach((item) => fragment.append(renderComment(item, 0)))
		if (append) list.append(fragment)
		else list.replaceChildren(fragment)
		renderMore()
	}

	// Пусто: подсказка вместо списка (пропадает с первым комментарием); у отключённых
	// комментариев — только плашка (Figma 4519:1890)
	const renderEmpty = () => {
		const empty = !list.querySelector('.comment')
		list.classList.toggle('is-empty', empty)
		if (!empty) return
		list.replaceChildren()
		if (state.enabled)
			list.append(h('p', { class: 'comments__empty', text: 'Комментариев пока нет' }))
	}

	const renderComposer = () => {
		composerHost.replaceChildren()
		// Плашка «отключены» — всем, поле ввода — только вошедшим
		if (!state.enabled) {
			composerHost.append(
				h(
					'div',
					{ class: 'comments__disabled' },
					icon('comment', 'comments__disabled-icon'),
					h('p', { text: 'Комментарии к этому материалу отключены' })
				)
			)
			return
		}
		if (!state.currentUser) return
		const { form } = createForm({
			mode: 'new',
			placeholder: 'Написать комментарий',
			submitText: 'Отправить',
			onSubmit: async (text) => {
				const result = await post('create', { entity, entityId, parentId: 0, text })
				if (signal.aborted || !result.comment) return
				const el = renderComment(result.comment, 0)
				if (list.classList.contains('is-empty')) {
					list.replaceChildren()
					list.classList.remove('is-empty')
				}
				list.prepend(el)
				setCount(state.total + 1)
				flash(el)
				announce(
					result.comment.status === 'pending'
						? 'Комментарий отправлен на модерацию'
						: 'Комментарий опубликован'
				)
			},
		})
		composerHost.append(form)
	}

	const firstLoad = async (initial) => {
		showStatus('')
		try {
			const page = initial || (await getPage())
			if (signal.aborted) return
			loaded = true
			applyPage(page, { append: false })
			renderComposer()
			renderEmpty()
		} catch {
			if (signal.aborted) return
			list.replaceChildren()
			showStatus('Не удалось загрузить комментарии.', () => firstLoad())
		}
	}

	moreButton.addEventListener(
		'click',
		async () => {
			if (!state.nextCursor || moreButton.disabled) return
			moreButton.disabled = true
			moreButton.classList.add('is-loading')
			moreButton.textContent = 'Загрузка'
			try {
				const page = await getPage({ cursor: state.nextCursor })
				if (signal.aborted) return
				applyPage(page, { append: true })
			} catch {
				announce('Не удалось загрузить комментарии')
			} finally {
				if (!signal.aborted) {
					moreButton.disabled = false
					moreButton.classList.remove('is-loading')
					moreButton.textContent = 'Показать ещё комментарии'
				}
			}
		},
		{ signal }
	)

	// Относительное время обновляется раз в минуту
	timeTimer = setInterval(() => {
		root.querySelectorAll('.comment__time').forEach((el) => {
			el.textContent = relativeTime(el.getAttribute('datetime'))
		})
	}, 60000)

	// Первая порция: из страницы — сразу; иначе — когда блок близко к экрану
	const initialEl = root.querySelector('[data-comments-initial]')
	let initial = null
	try {
		initial = initialEl ? JSON.parse(initialEl.textContent) : null
	} catch {
		initial = null
	}
	if (initial) firstLoad(initial)
	else if ('IntersectionObserver' in window) {
		observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting) || loaded) return
				observer.disconnect()
				firstLoad()
			},
			{ rootMargin: '600px 0px' }
		)
		observer.observe(root)
	} else firstLoad()

	// Переход по якорю #comments до загрузки — грузим сразу
	if (window.location.hash === `#${root.id}` && !initial) {
		observer?.disconnect()
		firstLoad()
	}

	return () => {
		controller.abort()
		pending.forEach((own) => own.abort())
		observer?.disconnect()
		clearInterval(timeTimer)
		timers.forEach(clearTimeout)
		closePopover()
		nodes.clear()
	}
}
