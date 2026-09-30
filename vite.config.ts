import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { resolve, sep } from 'node:path'
import fg from 'fast-glob'
import Handlebars from 'handlebars'
import autoprefixer from 'autoprefixer'
import { format as formatCode } from 'prettier'

const APP_ROOT = resolve(__dirname, 'app')
const ICONS_ROOT = resolve(APP_ROOT, 'assets/icons')
const SVG_SPRITE_ID = 'virtual:svg-icons-register'
const RESOLVED_SVG_SPRITE_ID = `\0${SVG_SPRITE_ID}`
let BASE: string = '/'

const isExternalLike = (p: string) =>
	!p || p.startsWith('#') || p.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(p)

const withBase = (p: string) => {
	if (isExternalLike(p)) return p
	const base = BASE.endsWith('/') ? BASE : BASE + '/'
	const norm = p.replace(/^\//, '')
	if (norm.startsWith(base.replace(/^\//, ''))) return p
	return base + norm
}

function captureBase(mode: string, prefixPageLinks: boolean) {
	return {
		name: 'capture-base',
		enforce: 'pre',
		configResolved(cfg: any) {
			BASE = cfg.base || '/'
			console.log(
				`[capture-base] BASE=${BASE} mode=${mode} prefixPageLinks=${prefixPageLinks}`
			)
		},
	}
}

function fixSrcset(v: string) {
	return String(v)
		.split(',')
		.map((s) => {
			const part = s.trim()
			if (!part) return part
			const [url, ...rest] = part.split(/\s+/)
			const patched = withBase(url)
			return [patched, ...rest].join(' ')
		})
		.join(', ')
}

function prefixDataAttrs(html: string, fileName: string) {
	const RE =
		/\s(data-[\w:-]*?(?:src|href|poster)[\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi

	let changed = 0
	const samples: string[] = []

	const patched = html.replace(RE, (m, name, dq, sq, bare) => {
		const val = dq ?? sq ?? bare ?? ''
		const next = name.toLowerCase().includes('srcset') ? fixSrcset(val) : withBase(val)
		if (next !== val) {
			changed++
			if (samples.length < 6) samples.push(`${name}: ${val} → ${next}`)
		}
		const quoted = dq != null ? `"${next}"` : sq != null ? `'${next}'` : `"${next}"`
		return ` ${name}=${quoted}`
	})

	if (changed) {
		console.log(`[prefixDataAttrs] ${fileName}: changed=${changed}\n  ${samples.join('\n  ')}`)
	}

	return patched
}

function prefixPageLinks(html: string, fileName: string, enabled: boolean, mode: string) {
	if (!enabled) {
		console.log(`[prefixPageLinks] ${fileName}: skipped (mode=${mode})`)
		return html
	}

	const DISALLOW_FIRST_SEG = new Set([
		'assets',
		'fonts',
		'favicon',
		'images',
		'img',
		'videos',
		'media',
		'static',
		'@',
	])
	const EXT_BLOCK = new Set([
		'png',
		'jpg',
		'jpeg',
		'gif',
		'svg',
		'webp',
		'avif',
		'ico',
		'mp4',
		'webm',
		'mov',
		'ogg',
		'mp3',
		'wav',
		'woff',
		'woff2',
		'ttf',
		'otf',
		'eot',
		'css',
		'js',
		'json',
		'xml',
		'txt',
		'pdf',
		'webmanifest',
		'map',
	])

	let changed = 0
	const samples: string[] = []

	const patched = html.replace(/<a\b[^>]*?>/gi, (tag) => {
		return tag.replace(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i, (m, dq, sq, bare) => {
			const val = dq ?? sq ?? bare ?? ''

			if (isExternalLike(val)) return m
			if (!val.startsWith('/')) return m

			const base = BASE.endsWith('/') ? BASE : BASE + '/'
			if (val.replace(/^\//, '').startsWith(base.replace(/^\//, ''))) return m

			const [pathPart] = val.split(/[?#]/)
			const firstSeg = pathPart.replace(/^\//, '').split('/')[0].toLowerCase()
			if (DISALLOW_FIRST_SEG.has(firstSeg)) return m

			const last = pathPart.split('/').pop() || ''
			const ext = last.includes('.') ? last.split('.').pop()!.toLowerCase() : ''
			if (EXT_BLOCK.has(ext)) return m

			const next = withBase(val)
			if (next !== val) {
				changed++
				if (samples.length < 6) samples.push(`href: ${val} → ${next}`)
			}
			const quoted = dq != null ? `"${next}"` : sq != null ? `'${next}'` : `"${next}"`
			return ` href=${quoted}`
		})
	})

	if (changed) {
		console.log(`[prefixPageLinks] ${fileName}: changed=${changed}\n  ${samples.join('\n  ')}`)
	}
	return patched
}

function formatHtml(prefixLinks: boolean, mode: string) {
	return {
		name: 'format-html',
		apply: 'build',
		enforce: 'post',
		async writeBundle(options, bundle) {
			const outDir = options.dir || path.dirname(options.file || '')
			for (const fileName of Object.keys(bundle)) {
				if (!fileName.endsWith('.html')) continue

				const abs = path.join(outDir, fileName)
				if (!fs.existsSync(abs)) continue

				let html = await formatCode(fs.readFileSync(abs, 'utf8'), {
					parser: 'html',
					useTabs: true,
					tabWidth: 1,
					printWidth: 120,
					htmlWhitespaceSensitivity: 'ignore',
				})
				html = prefixDataAttrs(html, fileName)
				html = prefixPageLinks(html, fileName, prefixLinks, mode)
				fs.writeFileSync(abs, html)
			}
		},
	}
}

function copyStaticAssets() {
	const groups = [
		{
			dir: 'images',
			pattern: '**/*.{png,jpg,jpeg,gif,svg,webp,avif,ico}',
		},
		{
			dir: 'videos',
			pattern: '**/*.{mp4,webm,mov,ogg}',
		},
		{
			dir: 'lottie',
			pattern: '**/*.{json,lottie,png,jpg,jpeg,webp,avif,gif}',
		},
		{
			dir: 'json',
			pattern: '**/*.json',
		},
	]

	return {
		name: 'copy-static-assets',
		apply: 'build',
		closeBundle() {
			for (const { dir, pattern } of groups) {
				const srcDir = path.resolve(__dirname, `app/assets/${dir}`)
				const outDir = path.resolve(__dirname, `dist/assets/${dir}`)
				if (!fs.existsSync(srcDir)) continue

				const files = fg.sync(pattern, { cwd: srcDir })
				if (!files.length) continue

				fs.mkdirSync(outDir, { recursive: true })
				for (const rel of files) {
					const from = path.join(srcDir, rel)
					const to = path.join(outDir, rel)
					fs.mkdirSync(path.dirname(to), { recursive: true })
					fs.copyFileSync(from, to)
				}
				console.log(`[copy-static-assets] ${dir}: copied ${files.length} files`)
			}
		},
	}
}

function devPagesRouter() {
	const flattenKey = (relFromApp) =>
		relFromApp
			.replace(/^pages\//, '')
			.replace(/\([^)]*\)\//g, '')
			.replace(/\.html$/, '')
			.replace(/[\\/]/g, '-')

	const buildMap = () => {
		const files = fg.sync('pages/**/*.html', { cwd: APP_ROOT, absolute: true, dot: false })
		const map = new Map<string, string>()
		for (const abs of files) {
			const relFromApp = path.relative(APP_ROOT, abs).replace(/\\/g, '/')
			const direct = '/' + relFromApp.replace(/^pages\//, '')
			const flat = '/' + flattenKey(relFromApp) + '.html'

			map.set(direct, '/' + relFromApp)
			map.set(flat, '/' + relFromApp)
		}
		return map
	}

	return {
		name: 'dev-pages-router',
		apply: 'serve',
		configureServer(server) {
			let MAP = buildMap()
			server.watcher.on('add', (p) => p.endsWith('.html') && (MAP = buildMap()))
			server.watcher.on('unlink', (p) => p.endsWith('.html') && (MAP = buildMap()))

			server.middlewares.use((req, _res, next) => {
				const url = (req.url || '/').split('?')[0]

				if (
					url.startsWith('/assets/') ||
					url.startsWith('/fonts/') ||
					url.startsWith('/favicon/') ||
					url.startsWith('/@')
				)
					return next()

				if (url === '/') {
					req.url = '/pages/index.html'
					return next()
				}

				if (MAP.has(url)) {
					req.url = MAP.get(url)!
					return next()
				}

				if (!/\.[a-z0-9]+$/i.test(url)) {
					const withHtml = url.replace(/\/+$/, '') + '.html'
					if (MAP.has(withHtml)) {
						req.url = MAP.get(withHtml)!
						return next()
					}
				}

				const candidate = '/pages' + (/\.[a-z0-9]+$/i.test(url) ? url : url + '.html')
				if (fs.existsSync(path.resolve(APP_ROOT, candidate.replace(/^\//, '')))) {
					req.url = candidate
				}

				next()
			})
		},
	}
}

function loadJSON(p: string) {
	try {
		return JSON.parse(fs.readFileSync(p, 'utf8'))
	} catch (e: any) {
		if (e?.code !== 'ENOENT') {
			console.error('[site.config.json] parse/load error:', e?.message, 'at', p)
		}
		return null
	}
}

function outNameFromHtmlPath(absHtmlPath: string) {
	const appRoot = resolve(__dirname, 'app') + sep
	const rel = absHtmlPath.startsWith(appRoot) ? absHtmlPath.slice(appRoot.length) : absHtmlPath

	const clean = rel.replace(/^[/\\]+/, '')

	return clean
		.replace(/^pages[\\/]/, '')
		.replace(/\([^)]*\)[\\/]/g, '')
		.replace(/\.html$/, '')
		.replace(/[\\/]/g, '-')
}

// Служебные страницы (состояния блоков и т. п.): есть в dev и в демо-сборке,
// но не попадают в сборку для CMS (--mode cms)
const DEV_PAGES_GLOB = 'pages/dev/**'

function getHtmlInputs(mode: string) {
	const files = fg.sync('pages/**/*.html', {
		cwd: APP_ROOT,
		dot: false,
		ignore: mode === 'cms' ? [DEV_PAGES_GLOB] : [],
	})
	const inputs: Record<string, string> = {}
	for (const file of files) {
		const name = file
			.replace(/^pages\//, '')
			.replace(/\([^)]*\)\//g, '')
			.replace(/\.html$/, '')
			.replace(/[\\/]/g, '-')
		if (inputs[name]) {
			throw new Error(`HTML output collision for "${name}.html": ${inputs[name]} and ${file}`)
		}
		inputs[name] = resolve(APP_ROOT, file)
	}
	return inputs
}

function handlebarsPlugin({ partialDirectory, helpers, context }) {
	const hbs = Handlebars.create()
	const partialNames = new Set<string>()
	const partialRoot = resolve(partialDirectory)

	for (const [name, helper] of Object.entries(helpers || {})) {
		hbs.registerHelper(name, helper)
	}

	function isPartialFile(file: string) {
		const absoluteFile = resolve(file)
		return (
			absoluteFile.startsWith(`${partialRoot}${sep}`) && /\.(?:hbs|html)$/i.test(absoluteFile)
		)
	}

	function registerPartials(pluginContext?) {
		for (const name of partialNames) hbs.unregisterPartial(name)
		partialNames.clear()

		const files = fg.sync('**/*.{hbs,html}', { cwd: partialRoot, absolute: true }).sort()
		for (const file of files) {
			const name = path
				.relative(partialRoot, file)
				.replace(/\\/g, '/')
				.replace(/\.(?:hbs|html)$/i, '')
			hbs.registerPartial(name, fs.readFileSync(file, 'utf8'))
			partialNames.add(name)
			pluginContext?.addWatchFile(file)
		}
	}

	return {
		name: 'local-handlebars',
		buildStart() {
			registerPartials(this)
		},
		handleHotUpdate({ file, server }) {
			if (!isPartialFile(file)) return
			registerPartials()
			server.ws.send({ type: 'full-reload' })
			return []
		},
		transformIndexHtml: {
			order: 'pre',
			async handler(html, ctx) {
				registerPartials()
				const pagePath = ctx.filename || ctx.path
				const data = typeof context === 'function' ? await context(pagePath) : context
				return hbs.compile(html)(data)
			},
		},
	}
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function prefixSvgIds(svg: string, prefix: string) {
	const ids = [...svg.matchAll(/\bid=(['"])([^'"]+)\1/g)].map((match) => match[2])
	let result = svg

	for (const id of new Set(ids)) {
		const nextId = `${prefix}-${id}`
		const escapedId = escapeRegExp(id)
		result = result
			.replace(new RegExp(`(\\bid=(['"]))${escapedId}(['"])`, 'g'), `$1${nextId}$3`)
			.replace(new RegExp(`url\\(#${escapedId}\\)`, 'g'), `url(#${nextId})`)
			.replace(
				new RegExp(`((?:href|xlink:href)=(['"]))#${escapedId}(['"])`, 'g'),
				`$1#${nextId}$3`
			)
	}

	return result
}

function createSvgSymbol(file: string) {
	const relativePath = path.relative(ICONS_ROOT, file).replace(/\\/g, '/')
	const symbolId = `icon-${relativePath.replace(/\.svg$/i, '').replace(/[^a-z0-9_-]+/gi, '-')}`
	const source = fs.readFileSync(file, 'utf8').trim()
	const match = source.match(/^<svg\b([^>]*)>([\s\S]*?)<\/svg>\s*$/i)

	if (!match) throw new Error(`Invalid SVG icon: ${relativePath}`)

	const attributes = match[1].replace(
		/\s(?:xmlns(?::xlink)?|width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi,
		''
	)
	const content = prefixSvgIds(match[2], symbolId)

	return `<symbol id="${symbolId}"${attributes}>${content}</symbol>`
}

function svgSpritePlugin() {
	return {
		name: 'local-svg-sprite',
		resolveId(id: string) {
			if (id === SVG_SPRITE_ID) return RESOLVED_SVG_SPRITE_ID
		},
		load(id: string) {
			if (id !== RESOLVED_SVG_SPRITE_ID) return

			const files = fg.sync('**/*.svg', { cwd: ICONS_ROOT, absolute: true }).sort()
			files.forEach((file) => this.addWatchFile(file))
			const symbols = files.map(createSvgSymbol).join('')
			const sprite = symbols
				? `<svg id="svg-icon-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${symbols}</svg>`
				: ''

			return `
				const sprite = ${JSON.stringify(sprite)};
				const spriteId = 'svg-icon-sprite';
				function mountSprite() {
					document.getElementById(spriteId)?.remove();
					if (!sprite || !document.body) return;
					const template = document.createElement('template');
					template.innerHTML = sprite;
					document.body.prepend(template.content.firstElementChild);
				}
				if (document.readyState === 'loading') {
					document.addEventListener('DOMContentLoaded', mountSprite, { once: true });
				} else {
					mountSprite();
				}
				if (import.meta.hot) import.meta.hot.dispose(() => document.getElementById(spriteId)?.remove());
			`
		},
		// Новая или удалённая иконка в dev: без этого спрайт собирался только при запуске
		// сервера, и добавленные иконки не появлялись до перезапуска
		configureServer(server) {
			const onIconsChange = (file: string) => {
				if (!file.startsWith(ICONS_ROOT) || !file.endsWith('.svg')) return
				const module = server.moduleGraph.getModuleById(RESOLVED_SVG_SPRITE_ID)
				if (module) server.moduleGraph.invalidateModule(module)
				server.ws.send({ type: 'full-reload' })
			}
			server.watcher.on('add', onIconsChange)
			server.watcher.on('unlink', onIconsChange)
		},
		handleHotUpdate({ file, server }) {
			if (file.startsWith(ICONS_ROOT) && file.endsWith('.svg')) {
				const module = server.moduleGraph.getModuleById(RESOLVED_SVG_SPRITE_ID)
				if (module) server.moduleGraph.invalidateModule(module)
				server.ws.send({ type: 'full-reload' })
				return []
			}
		},
	}
}

function flattenPagesToRoot() {
	return {
		name: 'flatten-pages-to-root',
		apply: 'build',
		enforce: 'post',
		generateBundle(_: any, bundle: Record<string, any>) {
			for (const [fileName, asset] of Object.entries(bundle)) {
				if (asset?.type !== 'asset' || !fileName.endsWith('.html')) continue
				if (!fileName.startsWith('pages/')) continue

				// То же правило, что в getHtmlInputs и dev-роутере: pages/dev/ui.html →
				// dev-ui.html. Раньше брался только basename, и pages/a/index.html с
				// pages/b/index.html молча перезаписывали друг друга.
				const newName = fileName
					.replace(/^pages\//, '')
					.replace(/\([^)]*\)\//g, '')
					.replace(/\//g, '-')
				const source = String(asset.source ?? '')

				this.emitFile({ type: 'asset', fileName: newName, source })
				delete bundle[fileName]
			}
		},
	}
}

export default defineConfig(({ mode }) => {
	const prefixPageLinks = mode !== 'cms'

	return {
		root: APP_ROOT,
		base: process.env.BASE || '/',
		publicDir: resolve(__dirname, 'public'),
		resolve: { alias: { '@': resolve(__dirname, 'app') } },

		build: {
			outDir: resolve(__dirname, 'dist'),
			emptyOutDir: true,
			cssCodeSplit: true,
			manifest: 'manifest.json',
			rollupOptions: {
				input: getHtmlInputs(mode),
				output: {
					entryFileNames: 'assets/js/[name]-[hash].js',
					chunkFileNames: 'assets/js/[name]-[hash].js',
					assetFileNames: ({ name }) => {
						const ext = (name?.split('.').pop() || '').toLowerCase()
						if (/png|jpe?g|gif|svg|webp|avif|ico/.test(ext))
							return 'assets/images/[name]-[hash][extname]'
						if (/mp4|webm|mov|ogg/.test(ext))
							return 'assets/videos/[name]-[hash][extname]'
						if (/woff2?|ttf|otf|eot/.test(ext))
							return 'assets/fonts/[name]-[hash][extname]'
						if (ext === 'css') return 'assets/css/[name]-[hash][extname]'
						return 'assets/[name]-[hash][extname]'
					},
				},
			},
			sourcemap: false,
		},

		plugins: [
			captureBase(mode, prefixPageLinks),
			devPagesRouter(),
			handlebarsPlugin({
				partialDirectory: resolve(__dirname, 'app/components'),
				helpers: {
					asset(v: any) {
						return typeof v === 'string' ? withBase(v) : v
					},
					attrs(obj: any) {
						if (!obj || typeof obj !== 'object') return ''
						const urlish = new Set([
							'href',
							'src',
							'poster',
							'srcset',
							'data-src',
							'data-src-mp4',
							'data-src-webm',
							'data-src-mp4-mobile',
							'data-src-mp4-desktop',
							'data-src-mobile',
							'data-src-desktop',
						])
						return Object.entries(obj)
							.filter(([_, v]) => v !== null && v !== undefined && v !== false)
							.map(([k, v]) => {
								let val = v
								if (typeof v === 'string') {
									if (k === 'srcset') val = fixSrcset(v)
									else if (urlish.has(k)) val = withBase(v)
								}
								return `${k}="${String(val).replace(/"/g, '&quot;')}"`
							})
							.join(' ')
					},
					default(v: any, fb: any) {
						return v !== undefined && v !== null && v !== '' ? v : fb
					},
					add(a: any, b: any) {
						return Number(a) + Number(b)
					},
					// Разбивка списка на страницы: {{#each (chunk items 4)}} — для каруселей по N пунктов
					chunk(list: any, size: any) {
						if (!Array.isArray(list)) return []
						const step = Math.max(1, Number(size) || 1)
						const pages: any[] = []
						for (let i = 0; i < list.length; i += step)
							pages.push(list.slice(i, i + step))
						return pages
					},
					obj(...args) {
						const options = args[args.length - 1]
						const hasOptions =
							options && typeof options === 'object' && 'hash' in options
						const params = hasOptions ? args.slice(0, -1) : args

						if (hasOptions && options.hash && Object.keys(options.hash).length) {
							return options.hash
						}

						if (
							params.length &&
							params.every((x) => x && typeof x === 'object' && !Array.isArray(x))
						) {
							return Object.assign({}, ...params)
						}

						const out = {}
						for (let i = 0; i < params.length; i += 2) {
							const k = params[i]
							const v = params[i + 1]
							if (k != null) out[String(k)] = v
						}
						return out
					},
					arr(...args: any[]) {
						args.pop()
						return args
					},
					and(...args: any[]) {
						args.pop()
						return args.every(Boolean)
					},
					eq(a: any, b: any) {
						return a === b
					},
					cls(cond: any, token: string) {
						return cond ? ` ${token}` : ''
					},
					json(v: any) {
						return JSON.stringify(v)
					},
					striptags(v: any) {
						return String(v ?? '').replace(/<[^>]*>/g, '')
					},
					or(...args: any[]) {
						args.pop()
						for (const v of args) if (v) return v
						return ''
					},
					isSet(...args: any[]) {
						args.pop()
						const v = args[0]
						if (v === undefined || v === null) return false
						if (typeof v === 'string') return v.trim() !== ''
						if (Array.isArray(v)) return v.length > 0
						if (typeof v === 'object') return Object.keys(v).length > 0
						return true
					},
					isEmpty(...args: any[]) {
						args.pop()
						const v = args[0]
						if (v === undefined || v === null) return true
						if (typeof v === 'string') return v.trim() === ''
						if (Array.isArray(v)) return v.length === 0
						if (typeof v === 'object') return Object.keys(v).length === 0
						return false
					},
					not(v: any) {
						return !v
					},
				},

				context: (htmlPath) => {
					const site = loadJSON(resolve(__dirname, 'site.config.json')) || {}
					const absoluteHtmlPath = htmlPath.startsWith(APP_ROOT)
						? htmlPath
						: resolve(APP_ROOT, htmlPath.replace(/^[/\\]+/, ''))

					const baseMeta = [
						{ charset: 'utf-8' },
						// viewport-fit=cover — для env(safe-area-inset-*): TabBar и шторки над полосой iPhone
						{
							name: 'viewport',
							content: 'width=device-width, initial-scale=1, viewport-fit=cover',
						},
						...(Array.isArray(site.meta) ? site.meta : []).filter(
							(m: any) => !('charset' in m) && m?.name !== 'viewport'
						),
					]

					const linksAll = Array.isArray(site.link) ? site.link : []
					const linkPreload = linksAll.filter((l: any) => l?.rel === 'preload')
					const linkOther = linksAll.filter((l: any) => l?.rel !== 'preload')

					const outName = outNameFromHtmlPath(absoluteHtmlPath)
					const pageJsonPath = absoluteHtmlPath.replace(/\.html$/, '.page.json')
					const pageCfg = loadJSON(pageJsonPath) || {}

					const title = pageCfg.title || site.seoDefaults?.title || site.siteName || ''
					const description = pageCfg.description || site.seoDefaults?.description || ''
					const ogImage = pageCfg.ogImage || site.seoDefaults?.ogImage || ''
					const twitterCard =
						pageCfg.twitterCard ||
						site.seoDefaults?.twitterCard ||
						'summary_large_image'

					let canonical = pageCfg.canonical || ''
					if (!canonical && site.siteUrl) {
						canonical = new URL(
							outName === 'index' ? '/' : `/${outName}.html`,
							site.siteUrl
						).toString()
					}

					return {
						site,
						lang: site.lang || 'ru',

						baseMeta,
						meta: [],
						linkPreload,
						linkOther,

						page: { canonical },
						head: { title, description, ogImage, twitterCard },
						// Данные страницы для шаблона: ключ data в <page>.page.json
						// (демо-контент витрины и статических страниц)
						data: pageCfg.data || {},
					}
				},
			}),
			svgSpritePlugin(),
			flattenPagesToRoot(),
			formatHtml(prefixPageLinks, mode),
			copyStaticAssets(),
		].filter(Boolean),

		css: {
			devSourcemap: true,
			postcss: {
				plugins: [autoprefixer()],
			},
		},
	}
})
