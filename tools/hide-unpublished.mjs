// Убирает из сборки (и, для natix, из исходников) страницы, которых нет в
// tools/published-pages.txt: её HTML, строку в «Страницах вёрстки» (dev-pages.json), истории
// витрины с data-page="<страница>", а в исходниках — app/pages/<страница>.html, .page.json и
// контракт docs/contracts/<страница>.md. Код блоков остаётся (на нём держится общая сборка).
//   node tools/hide-unpublished.mjs <папка сборки> [<папка исходников>]
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const [distDir, srcDir] = process.argv.slice(2)
const tools = path.dirname(new URL(import.meta.url).pathname)
const keep = new Set(
	execFileSync('bash', [path.join(tools, 'published-pages.sh')], { encoding: 'utf8' })
		.split('\n')
		.filter(Boolean)
)
keep.add('dev-pages')

const pages = fs
	.readdirSync(path.join(srcDir || path.join(tools, '..'), 'app/pages'))
	.filter((f) => f.endsWith('.html'))
	.map((f) => f.replace(/\.html$/, ''))
const hidden = pages.filter((name) => !keep.has(name))

const rm = (file) => fs.existsSync(file) && fs.rmSync(file)

// Истории витрины с data-page скрытой страницы: вырезаем <article class="story" …> целиком
// (считаем вложенные <article>)
function stripStories(html) {
	for (const name of hidden) {
		const marker = `data-page="${name}"`
		let start
		while ((start = html.search(new RegExp(`<article\\b[^>]*${marker}`))) !== -1) {
			const tag = /<\/?article\b[^>]*>/g
			tag.lastIndex = start
			let depth = 0
			let match
			while ((match = tag.exec(html))) {
				depth += match[0][1] === '/' ? -1 : 1
				if (depth === 0) break
			}
			html = html.slice(0, start) + html.slice(match ? tag.lastIndex : html.length)
		}
	}
	return html
}

for (const name of hidden) rm(path.join(distDir, `${name}.html`))
for (const file of fs.readdirSync(distDir)) {
	if (!/^dev-.*\.html$/.test(file)) continue
	const full = path.join(distDir, file)
	const html = fs.readFileSync(full, 'utf8')
	const next = stripStories(html)
	if (next !== html) fs.writeFileSync(full, next)
}
const index = path.join(distDir, 'dev-pages.json')
if (fs.existsSync(index)) {
	const data = JSON.parse(fs.readFileSync(index, 'utf8'))
	data.pages = data.pages.filter((page) => !hidden.includes(page.name))
	fs.writeFileSync(index, JSON.stringify(data))
}
if (srcDir) {
	for (const name of hidden) {
		rm(path.join(srcDir, 'app/pages', `${name}.html`))
		rm(path.join(srcDir, 'app/pages', `${name}.page.json`))
		rm(path.join(srcDir, 'docs/contracts', `${name}.md`))
	}
}
console.log(hidden.length ? `не показываем: ${hidden.join(', ')}` : 'показываем все страницы')
