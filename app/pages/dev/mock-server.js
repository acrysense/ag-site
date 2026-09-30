// Только для витрины: имитация сервера.
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
