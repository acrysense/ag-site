// Только для витрины: имитация сервера для выпадающего списка с загрузкой (Select с url).
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
