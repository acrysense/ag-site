// Только для витрины и демо-страниц: имитация сервера (в сборку для CMS не попадает).
// 1) Выпадающий список с загрузкой (Select с url).
// GET /__mock/select?q=&cursor= → { items: [{ value, text }], next }. 240 сотрудников, порции
// по 20, задержка 400 мс; ?fail=1 — ошибка 500. В консоль пишется каждый запрос — видно,
// сколько их уходит при наборе и прокрутке.
const surnames = [
	'Волкова',
	'Дрозд',
	'Ковалёв',
	'Лебедева',
	'Новик',
	'Шевчук',
	'Жук',
	'Климович',
	'Мороз',
	'Кравченко',
	'Козловская',
	'Бондаренко',
]
const initials = ['А.И.', 'В.В.', 'Е.С.', 'Д.Г.', 'И.М.', 'О.В.', 'Л.А.', 'А.П.', 'Ю.Н.', 'М.С.']
const people = Array.from({ length: 240 }, (_, i) => ({
	value: String(i + 1),
	text: `${surnames[i % surnames.length]} ${initials[(i * 7) % initials.length]} — аптека №${100 + i}`,
}))
const PAGE = 20

const realFetch = window.fetch.bind(window)
window.fetch = async (input, init = {}) => {
	const source = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url
	const url = new URL(source, window.location.href)
	if (url.pathname === '/__mock/form') return mockForm(init)
	if (url.pathname === '/__mock/comments') return mockComments(url, init)
	if (url.pathname === '/__mock/search-count') return mockSearchCount(url, init)
	if (url.pathname === '/__mock/search-suggest') return mockSearchSuggest(url, init)
	if (url.pathname === '/__mock/search-filters') return mockSearchFilters(url, init)
	if (url.pathname !== '/__mock/select') return realFetch(input, init)
	console.info('[mock-select]', url.search || '(без параметров)')
	await new Promise((resolve, reject) => {
		const timer = setTimeout(resolve, 400)
		init.signal?.addEventListener('abort', () => {
			clearTimeout(timer)
			reject(new DOMException('Aborted', 'AbortError'))
		})
	})
	if (url.searchParams.get('fail')) return new Response('', { status: 500 })
	const q = (url.searchParams.get('q') || '').toLowerCase()
	const offset = Number(url.searchParams.get('cursor')) || 0
	const found = people.filter((person) => !q || person.text.toLowerCase().includes(q))
	const items = found.slice(offset, offset + PAGE)
	const next = offset + PAGE < found.length ? String(offset + PAGE) : null
	return new Response(JSON.stringify({ items, next }), {
		headers: { 'Content-Type': 'application/json' },
	})
}

// 2) Отправка формы: POST /__mock/form → { ok: true } через 800 мс. Тема со словом «ошибка» —
// 422 с ошибкой поля, «сбой» — 500 (общая ошибка).
async function mockForm(init) {
	const body = init.body instanceof FormData ? init.body : new FormData()
	console.info('[mock-form]', Object.fromEntries(body.entries()))
	await new Promise((resolve) => setTimeout(resolve, 800))
	const topic = String(body.get('topic') || '').toLowerCase()
	const json = (data, status) =>
		new Response(JSON.stringify(data), {
			status,
			headers: { 'Content-Type': 'application/json' },
		})
	if (topic.includes('сбой')) return new Response('', { status: 500 })
	if (topic.includes('ошибка')) {
		return json({ ok: false, errors: { topic: 'Такая тема уже предложена' }, message: '' }, 422)
	}
	return json({ ok: true, message: 'Спасибо! Ваше обращение передано в редакцию' }, 200)
}

// 3) Комментарии: /__mock/comments — контракт docs/contracts/comments.md. Материал задаёт
// entityId: demo — лента с ветками (вы администратор), user — обычный сотрудник, guest — гость,
// empty — пусто, disabled — отключены, loading — ответа нет, fail — ошибка загрузки. Текст со словом «ошибка» —
// отказ при отправке, «модерац» — ответ «на модерации». Задержка 500 мс.
const COMMENT_PAGE = 8
const PREVIEW = 2
const authors = [
	{ id: 2, name: 'Наталья Дрозд', role: 'Менеджер' },
	{ id: 3, name: 'Дмитрий Ковалёв', role: 'Руководитель' },
	{ id: 4, name: 'Ирина Панкевич', role: 'Провизор' },
	{ id: 5, name: 'Александр Морозов', role: '' },
	{ id: 6, name: 'Ольга Волкова', role: 'HR' },
	{ id: 7, name: 'Сергей Зайцев', role: '' },
]
const texts = [
	'С днём рождения, Александра Георгиевна! Спасибо за всё, что вы делаете для команды 🎂',
	'Коллеги, напоминаю: отчёты по визитам за неделю сдаём до пятницы 18:00.',
	'Отличная новость, поздравляю всех участников!',
	'Спасибо, всё понятно!',
	'А будет ли запись для тех, кто не смог прийти?\nХотелось бы посмотреть в выходные.',
	'Присоединяюсь к поздравлениям 👏',
]
const threads = {}
let commentId = 1000

function makeComment(parentId, index, minutesAgo) {
	const author = authors[index % authors.length]
	const likes = (index * 5) % 11
	const dislikes = index % 4 === 3 ? 3 : 0
	const reactions = {
		like: likes,
		dislike: dislikes,
		clap: index % 3,
		heart: index % 5 === 0 ? 2 : 0,
	}
	return {
		id: ++commentId,
		parentId,
		author,
		text: texts[index % texts.length],
		createdAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
		reactions,
		myReactions: index % 6 === 1 ? ['like'] : [],
		status: 'approved',
		edited: false,
		deleted: false,
		children: [],
	}
}

function seed(entityId) {
	if (threads[entityId]) return threads[entityId]
	const items = []
	if (!['empty', 'fail'].includes(entityId)) {
		for (let i = 0; i < 19; i++) {
			const comment = makeComment(0, i, 3 + i * 97)
			// Ветки: 3 ответа (два видно, «Показать ещё 1 ответ»), глубокая — до 4 уровней
			if (i === 1 || i === 4) {
				for (let r = 0; r < 3; r++)
					comment.children.push(makeComment(comment.id, i + r + 2, 1 + r * 20))
			}
			if (i === 2) {
				let parent = comment
				for (let depth = 0; depth < 3; depth++) {
					const reply = makeComment(parent.id, depth + 3, 2 + depth * 10)
					parent.children.push(reply)
					parent = reply
				}
			}
			items.push(comment)
		}
	}
	threads[entityId] = {
		items,
		enabled: entityId !== 'disabled',
		user: entityId === 'guest' ? null : { id: 1, name: 'Вы', isAdmin: entityId !== 'user' },
	}
	return threads[entityId]
}

function findComment(list, id) {
	for (const item of list) {
		if (item.id === id) return item
		const found = findComment(item.children, id)
		if (found) return found
	}
	return null
}

const countAll = (list) => list.reduce((sum, item) => sum + 1 + countAll(item.children), 0)
const scoreOf = (item) => (item.reactions.like || 0) - (item.reactions.dislike || 0)

function serialize(item, thread) {
	const { user } = thread
	const own = user && item.author.id === user.id
	return {
		id: item.id,
		parentId: item.parentId,
		author: item.author,
		text: item.deleted ? '' : item.text,
		createdAt: item.createdAt,
		score: scoreOf(item),
		reactions: item.reactions,
		myReactions: item.myReactions,
		status: item.status,
		edited: item.edited,
		deleted: item.deleted,
		canEdit: Boolean(user && (user.isAdmin || own)),
		canDelete: Boolean(user && user.isAdmin),
		replyCount: item.children.length,
		replies: item.children.slice(0, PREVIEW).map((child) => serialize(child, thread)),
		repliesCursor: item.children.length > PREVIEW ? item.children[PREVIEW - 1].createdAt : null,
	}
}

async function mockComments(url, init) {
	const action = url.searchParams.get('action')
	const payload = init.body ? JSON.parse(init.body) : {}
	console.info('[mock-comments]', action || 'list', url.search, payload)
	// entityId=loading — ответа нет (виден скелетон), пока запрос не отменят
	const hang = url.searchParams.get('entityId') === 'loading'
	await new Promise((resolve, reject) => {
		const timer = hang ? 0 : setTimeout(resolve, 500)
		init.signal?.addEventListener('abort', () => {
			clearTimeout(timer)
			reject(new DOMException('Aborted', 'AbortError'))
		})
	})
	const json = (data, status = 200) =>
		new Response(JSON.stringify(data), {
			status,
			headers: { 'Content-Type': 'application/json' },
		})
	const entityId = url.searchParams.get('entityId') || payload.entityId || 'demo'
	if (entityId === 'fail') return new Response('', { status: 500 })
	// POST приходит без entityId в адресе — ищем комментарий во всех материалах
	const thread =
		payload.commentId && !url.searchParams.get('entityId')
			? Object.values(threads).find((t) => findComment(t.items, payload.commentId)) ||
				seed(entityId)
			: seed(entityId)

	if (!action) {
		const parent = Number(url.searchParams.get('parent')) || 0
		// Курсор — время последнего отданного (keyset): удаление или новый комментарий
		// не сдвигают следующую порцию, как сдвинули бы смещение (offset)
		const cursor = url.searchParams.get('cursor') || ''
		const limit = Number(url.searchParams.get('limit')) || COMMENT_PAGE
		const source = (
			parent ? findComment(thread.items, parent)?.children || [] : thread.items
		).filter((item) => !cursor || item.createdAt < cursor)
		const items = source.slice(0, limit).map((item) => serialize(item, thread))
		return json({
			currentUser: thread.user && { id: thread.user.id, isAdmin: thread.user.isAdmin },
			commentsEnabled: thread.enabled,
			minLength: 10,
			maxLength: 500,
			items,
			nextCursor: source.length > limit ? items[items.length - 1].createdAt : null,
			total: countAll(thread.items),
		})
	}

	if (!thread.user) return json({ ok: false, message: 'Войдите, чтобы комментировать' }, 403)

	if (action === 'create') {
		if (!thread.enabled) return json({ ok: false, message: 'Комментарии отключены' }, 403)
		if (String(payload.text).toLowerCase().includes('ошибка'))
			return json({ ok: false, message: 'Не удалось отправить: сервер недоступен' }, 500)
		const item = {
			...makeComment(payload.parentId || 0, 0, 0),
			author: { id: thread.user.id, name: thread.user.name, role: '' },
			text: payload.text,
			reactions: {},
			myReactions: [],
			status: String(payload.text).toLowerCase().includes('модерац') ? 'pending' : 'approved',
		}
		const parent = payload.parentId ? findComment(thread.items, payload.parentId) : null
		;(parent ? parent.children : thread.items).unshift(item)
		return json({ ok: true, comment: serialize(item, thread) })
	}

	const item = findComment(thread.items, payload.commentId)
	if (!item) return json({ ok: false, message: 'Комментарий не найден' }, 404)

	if (action === 'react') {
		const mine = new Set(item.myReactions)
		const has = mine.has(payload.type)
		item.reactions[payload.type] = Math.max(
			0,
			(item.reactions[payload.type] || 0) + (has ? -1 : 1)
		)
		if (has) mine.delete(payload.type)
		else mine.add(payload.type)
		item.myReactions = [...mine]
		return json({
			ok: true,
			reactions: item.reactions,
			myReactions: item.myReactions,
			score: scoreOf(item),
		})
	}
	if (action === 'edit') {
		item.text = payload.text
		item.edited = true
		return json({ ok: true, comment: serialize(item, thread) })
	}
	if (action === 'delete') {
		if (item.children.length) {
			item.deleted = true
			return json({ ok: true, mode: 'placeholder' })
		}
		const parent = item.parentId ? findComment(thread.items, item.parentId) : null
		const list = parent ? parent.children : thread.items
		list.splice(list.indexOf(item), 1)
		return json({ ok: true, mode: 'removed' })
	}
	return json({ ok: false, message: 'Неизвестное действие' }, 400)
}

// 4) Поиск: число результатов для кнопки «Показать N результатов» (панель фильтров).
// GET /__mock/search-count?<параметры формы> → { count }. Чем больше фильтров, тем меньше.
async function mockSearchCount(url, init) {
	console.info('[mock-search-count]', url.search)
	await new Promise((resolve, reject) => {
		const timer = setTimeout(resolve, 300)
		init.signal?.addEventListener('abort', () => {
			clearTimeout(timer)
			reject(new DOMException('Aborted', 'AbortError'))
		})
	})
	const filters = [...url.searchParams.keys()].filter(
		(key) => !['q', 'section', 'sort'].includes(key)
	)
	const count = Math.max(0, 12 - filters.length * 2)
	return new Response(JSON.stringify({ count }), {
		headers: { 'Content-Type': 'application/json' },
	})
}

// 5) Поиск в шапке. GET /__mock/search-suggest?q=&section=&<фильтры> → { count, items } —
// до 6 подсказок раздела, совпадение в <mark>; каждый выбранный фильтр убавляет выдачу.
// GET /__mock/search-filters?section= → HTML фильтров раздела (берётся из <template
// data-site-search-demo>, которые демо-страницы выводят в поиске). Задержка 400 мс.
const photo = (n) => new URL(`./img/person-${n}.jpg`, import.meta.url).href
const suggestData = {
	directory: [
		[
			'Иванова Ольга Александровна',
			'Провизор · ООО «Адель Фарм» · Отдел продаж',
			'person',
			photo(1),
		],
		[
			'Иванчик Дмитрий Олегович',
			'Менеджер · ООО «Адель Фарм» · Отдел маркетинга',
			'person',
			photo(2),
		],
		[
			'Иваненко Мария Сергеевна',
			'Маркетолог · ООО «Адель Фарм» · Отдел маркетинга',
			'person',
			'',
		],
		[
			'Иванькова Анна Игоревна',
			'Специалист · ООО «Адель Фарм» · Отдел продаж',
			'person',
			photo(3),
		],
		[
			'Ивановский Павел Андреевич',
			'Руководитель · ООО «Адель Фарм» · Отдел продаж',
			'person',
			photo(4),
		],
		[
			'Петрова Анна Сергеевна',
			'Фармацевт · ООО «Аптека групп» · Аптека №4',
			'person',
			photo(5),
		],
	],
	news: [
		[
			'Иван Купала: как мы провели летний корпоратив',
			'Новости · 08.07.2026',
			'news',
			new URL('./img/news-1.jpg', import.meta.url).href,
		],
		[
			'Приказ о назначении: Иванов С.П. — директор по развитию',
			'Новости · 14.09.2026',
			'news',
			'',
		],
		[
			'Итоги программы «Лучшая аптека сезона»',
			'Новости · 28.03.2026',
			'news',
			new URL('./img/news-3.jpg', import.meta.url).href,
		],
	],
	documents: [
		[
			'Инструкция по приёмке товара (ред. Иванова О.А.)',
			'PDF · 1,2 МБ · Библиотека / Регламенты',
			'document',
			'',
		],
		[
			'Положение о премировании сотрудников (согласовано: Иванов С.П.)',
			'DOCX · 240 КБ · Библиотека / Кадры',
			'document',
			'',
		],
		[
			'Памятка новому сотруднику: к кому обращаться (Иванова О.А.)',
			'Страница сайта · обновлено 12.08.2026',
			'other',
			'',
		],
	],
	vacancies: [
		[
			'Фармацевт — аптека на ул. Ивановская, 12',
			'Вакансии · Минск · ООО «Добрыя лекі»',
			'vacancy',
			'',
		],
		[
			'Провизор — аптека №4, Иваново',
			'Вакансии · Иваново · ООО «Аптека групп» · от 1 800 BYN',
			'vacancy',
			'',
		],
	],
}
const escapeMock = (value) =>
	value.replace(
		/[&<>"]/g,
		(char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]
	)
const wait = (ms, signal) =>
	new Promise((resolve, reject) => {
		const timer = setTimeout(resolve, ms)
		signal?.addEventListener('abort', () => {
			clearTimeout(timer)
			reject(new DOMException('Aborted', 'AbortError'))
		})
	})

async function mockSearchSuggest(url, init) {
	console.info('[mock-search-suggest]', url.search)
	await wait(400, init.signal)
	const q = (url.searchParams.get('q') || '').trim().toLowerCase()
	const section = url.searchParams.get('section') || 'directory'
	const filters = [...url.searchParams.keys()].filter(
		(key) => !['q', 'section', 'ajax_call'].includes(key)
	).length
	const found = (suggestData[section] || []).filter(([title]) => title.toLowerCase().includes(q))
	const kept = found.slice(0, Math.max(0, found.length - filters))
	const items = kept.slice(0, 6).map(([title, meta, type, image]) => {
		const start = title.toLowerCase().indexOf(q)
		const titleHtml =
			escapeMock(title.slice(0, start)) +
			`<mark>${escapeMock(title.slice(start, start + q.length))}</mark>` +
			escapeMock(title.slice(start + q.length))
		return { url: '#', type, image, titleHtml, meta }
	})
	return new Response(JSON.stringify({ count: kept.length, items }), {
		headers: { 'Content-Type': 'application/json' },
	})
}

async function mockSearchFilters(url, init) {
	const section = url.searchParams.get('section') || 'directory'
	console.info('[mock-search-filters]', section)
	await wait(600, init.signal)
	const template = document.querySelector(`template[data-site-search-demo="${section}"]`)
	return new Response(template ? template.innerHTML : '', {
		headers: { 'Content-Type': 'text/html' },
	})
}
