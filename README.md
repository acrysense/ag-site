# my.apteka-group.by

Вёрстка нового корпоративного сайта под шаблон Битрикса. Multi-page сборка на Vite,
HTML/Handlebars и SCSS, создана из шаблона `acrysense/vite-starter`.

Правила работы — `AGENTS.md`.

## Требования

- Node.js `22.16.0` или новее;
- npm `10` или новее;
- рекомендуется использовать `nvm`: версия проекта зафиксирована в `.nvmrc`.

```sh
nvm use
node --version
npm --version
```

## Установка и запуск

Чистая установка зависимостей:

```sh
npm ci
```

Development-сервер:

```sh
npm run dev
```

Витрина компонентов (dev-сервер и сразу открытая `/dev/ui.html`):

```sh
npm run ui
```

Production-сборка в `dist`:

```sh
npm run build
```

Локальный просмотр готовой сборки:

```sh
npm run preview
```

Форматирование исходников:

```sh
npm run format
```

## BASE и CMS mode

Для размещения проекта не в корне домена передайте `BASE` с начальным и конечным `/`:

```sh
BASE=/demo/ npm run build
```

BASE применяется к локальным assets, fonts, `srcset`, поддерживаемым `data-*` URL и
межстраничным ссылкам.

CMS mode оставляет межстраничные ссылки без BASE, чтобы ими могла управлять CMS. Пути к
assets и URL в поддерживаемых data-атрибутах продолжают учитывать BASE:

```sh
BASE=/demo/ npm run build -- --mode cms
```

## Структура

```text
app/
  app.js                    # клиентская точка входа
  pages/                    # HTML entry points
  components/
    layouts/                # общие части страницы
    sections/               # секции страниц
    components/             # переиспользуемые UI-компоненты
  core/
    mount.js                # mount/dispose lifecycle
  utils/                    # универсальные JS-утилиты
  assets/
    styles/                 # SCSS layers: reset/base/layout/components/pages
    icons/                  # исходные SVG для sprite
    fonts/                  # готовые WOFF2 и optional WOFF
    images/                 # raw images
    videos/                 # raw video
    lottie/                 # Lottie JSON и связанные assets
    json/                   # прочие raw JSON
public/                     # файлы, копируемые Vite без обработки
tools/
  build-fonts.mjs           # fonts pipeline
site.config.json            # глобальные meta/link/SEO defaults
fonts.config.json           # настройки font-family и variable weights
vite.config.ts              # локальные Vite plugins и build config
dist/                       # результат production build
```

HTML-файлы из `app/pages` становятся отдельными entry points. В production они выводятся
в корень `dist`, например `app/pages/about.html` превращается в `dist/about.html`.
Конфигурация останавливает сборку при совпадении имён выходных HTML-файлов.

## HTML и Handlebars partials

Локальный Handlebars plugin регистрирует все `.hbs` и `.html` из `app/components`.
Имя partial совпадает с путём относительно этой папки без расширения:

```hbs
{{> layouts/Header/Header }}
{{> sections/home/Main/Main }}
{{> components/Button/Button props=(obj text="Отправить") }}
```

При изменении partial в dev выполняется full reload. Устанавливать
`vite-plugin-handlebars` для стандартной структуры не требуется.

Глобальные данные берутся из `site.config.json`. Для отдельной страницы можно создать
рядом файл `<page>.page.json` с `title`, `description`, `ogImage`, `twitterCard` или
`canonical`.

Полезные helpers уже доступны в шаблонах: `asset`, `attrs`, `default`, `obj`, `arr`,
`and`, `or`, `eq`, `cls`, `json`, `striptags`, `isSet`, `isEmpty`, `not`.

Для URL в ручной разметке используйте helper `asset`:

```hbs
<img src="{{asset '/assets/images/example.webp'}}" alt="" />
```

Helper `attrs` автоматически обрабатывает URL-подобные атрибуты и `srcset` в объектах.

## SVG sprite

Положите отдельные SVG-иконки в `app/assets/icons`. Локальный plugin собирает их в
inline sprite и монтирует его в начало `body`.

ID символа строится из относительного пути:

```text
app/assets/icons/close.svg       -> icon-close
app/assets/icons/social/mail.svg -> icon-social-mail
```

Использование:

```html
<svg aria-hidden="true" focusable="false">
	<use href="#icon-close"></use>
</svg>
```

Внутренние ID SVG автоматически получают префикс, поэтому gradients, masks и clip paths
разных иконок не конфликтуют. Цвета исходной иконки не переписываются автоматически.
Возвращать `vite-plugin-svg-icons` без отдельной проектной причины не нужно.

## Fonts

Font pipeline не конвертирует TTF/OTF. Добавляйте готовые web-font файлы:

```text
app/assets/fonts/Inter/Inter-Regular.woff2
app/assets/fonts/Inter/Inter-Regular.woff
app/assets/fonts/Inter/Inter-Variable.woff2
```

WOFF2 обязателен. Одноимённый WOFF подключается как optional fallback. Перед `dev` и
`build` автоматически выполняется `npm run fonts`, который:

1. копирует fonts в `public/fonts`;
2. определяет style/weight по имени файла;
3. генерирует `app/assets/styles/base/_fonts.generated.scss`.

Не редактируйте `_fonts.generated.scss` вручную. Переименование семейства и диапазоны
variable fonts настраиваются в `fonts.config.json`:

```json
{
	"defaults": { "display": "swap", "varWght": "300 700" },
	"families": {
		"Inter": {
			"cssFamily": "Inter",
			"normal": { "varWght": "300 700" },
			"italic": { "varWght": "300 700" }
		}
	}
}
```

## Raw assets

На production build файлы копируются без изменения структуры:

```text
app/assets/images/** -> dist/assets/images/**
app/assets/videos/** -> dist/assets/videos/**
app/assets/lottie/** -> dist/assets/lottie/**
app/assets/json/**   -> dist/assets/json/**
```

Raw copy нужен для CMS, runtime-запросов и файлов, к которым обращаются по стабильному
пути. Assets, импортированные из JS/SCSS или обнаруженные Vite в HTML, дополнительно могут
получить hash. Не храните один и тот же файл одновременно как raw asset и import без
необходимости, иначе в `dist` появятся две копии.

`public` используйте для favicon, manifest и других файлов, которые Vite должен копировать
как есть.

## Mount/dispose lifecycle

Элемент подключает JS-модуль через `data-module`. `data-path` задаёт группу внутри
`app/components`:

```html
<section data-module="Slider" data-path="sections/home"></section>
```

Для примера выше resolver ищет модуль в
`app/components/sections/home/Slider/Slider.js` или `index.js`. Поддерживаются PascalCase,
kebab-case и короткая запись `data-module="components/Slider"` для одноуровневой группы.
Для вложенных групп используйте отдельный `data-path`.

Модуль экспортирует функцию и может вернуть disposer:

```js
export default function init(root) {
	const button = root.querySelector('[data-action]')
	const controller = new AbortController()
	const onClick = () => {}

	button?.addEventListener('click', onClick)

	return () => {
		button?.removeEventListener('click', onClick)
		controller.abort()
	}
}
```

Disposer должен освобождать всё, что создал модуль:

- DOM/window/document listeners;
- `MutationObserver`, `ResizeObserver`, `IntersectionObserver`;
- timers и intervals;
- `requestAnimationFrame`;
- fetch через `AbortController`;
- Swiper и другие внешние instances;
- object URLs и временные DOM-элементы.

Модуль может быть `async`. Если функция ничего не вернула, disposer берётся из
`el.__dispose`. Если блок удалили, пока грузился его JS, результат инициализации сразу
освобождается.

Первичный DOM монтируется автоматически. Блоки, вставленные или удалённые позже (AJAX,
композитный кеш CMS), подхватывает `MutationObserver` в `app.js`: вставка монтирует, удаление
из документа размонтирует, перенос узла в другое место не переинициализирует блок.

Ручной вызов нужен, только если разметку меняют вне `document.body` или disposer должен
отработать строго до удаления:

```js
import { requestMount, requestUnmount } from '@/core/mount'

requestUnmount(oldRoot)
oldRoot.remove()

container.append(newRoot)
requestMount(newRoot)
```

Один и тот же элемент защищён от повторного mount через внутренний `WeakMap`. Собственные
флаги вроде `root.__bound` обычно не нужны, если модуль всегда управляется `mount.js`.

## Autosize и scroll-lock

Textarea подключается декларативно:

```html
<textarea data-autosize data-autosize-max-rows="6"></textarea>
```

Autosize очищает listeners и observers после удаления textarea из наблюдаемого DOM.

Scroll-lock поддерживает вложенные блокировки. Каждый вызов должен освободить именно свою
блокировку:

```js
import { lockBody } from '@/utils/scroll-lock'

const releaseScroll = lockBody()

return () => releaseScroll()
```

`releaseScroll` срабатывает один раз: повторный вызов (двойное закрытие модалки) не снимает
чужую блокировку.

## Слои CSS

```text
reset → vendor → base → layout → components → utilities
```

Стили библиотек кладите в `vendor`, тогда стили проекта перекрывают их без борьбы за
специфичность:

```scss
@use "sass:meta";

@layer vendor {
	@include meta.load-css("swiper/css");
}
```

## Базовые умолчания

- `body { overflow-x: clip }`, а не `hidden`: иначе ломается `position: sticky`.
- Глобальное кольцо `:focus-visible`. Цвет меняется через `--focus-ring-color`, `outline: none`
  без замены не используйте.
- Поля ввода не меньше 16px, чтобы iOS не зумил страницу. Масштаб во viewport не запрещается.
- `appearance: none` у полей и `select`; чекбоксы, радио и range остаются нативными.

## Цвета и текст

Значения берутся только из макета, пока его нет — заготовки пустые. Всё объявляется один
раз в `app/assets/styles/base/_vars.scss`:

```scss
$colors: (
	"white": #ffffff,
	"black": #000000,
);

$text-styles: (
	"h1": (mobile: 32, desktop: 64, line-height: 1.1, weight: 700),
	"body": (mobile: 16, desktop: 18, line-height: 1.5),
);
```

В блоках — `palette("имя")` и `@include text("имя")`:

```scss
.news__title {
	@include text("h1");
	color: palette("black");
}
```

Размеры в `$text-styles` — пиксели мобильного и десктопного макетов. Как они масштабируются
между ширинами, решает только миксин `text` в `_mixins.scss`: сменить подход можно в одном
месте, не трогая блоки. Ширина десктопного макета задаётся `$default-range` (`lg` — 1440,
`xl` — 1920). Неизвестное имя цвета или стиля останавливает сборку с ошибкой.

## Витрина компонентов

Своя витрина в духе Storybook, без отдельных зависимостей. Запуск — `npm run ui`
(или `npm run dev` и адрес `/dev/ui.html`), в сборке — `dev-ui.html`. Слева меню с группами,
сверху переключатель ширины (360, 768, 1280, 1440, 1920, по окну). Выбранная история и ширина
хранятся в адресе (`#story=colors&w=360`), ссылку можно отправить.

В группе «Основа» уже есть «Цвета» и «Типографика»: они строятся из `$colors` и
`$text-styles` сами и показывают текущие размеры на выбранной ширине. Компоненты
добавляются по мере вёрстки.

- `app/pages/dev/ui.html` — оболочка: меню, панель ширин, iframe.
- `app/pages/dev/canvas.html` — холст со всеми историями. Оболочка открывает его с
  `?story=<id>`, поэтому медиазапросы работают по-настоящему. Истории рендерятся теми же
  Handlebars-partials, что и страницы для Битрикса.

Новая история добавляется в `canvas.html`, меню строится само:

```hbs
{{#> story id="button" group="Компоненты" title="Кнопка"}}
	{{#> state label="Обычная"}}
		{{> components/Button/Button props=(obj text="Отправить")}}
	{{/state}}
	{{#> state label="Загрузка" note="не применимо: состояние отправки показывает форма"}}{{/state}}
{{/story}}
```

Каждый блок показывается во всех состояниях: обычное, загрузка, пусто, ошибка, длинный
контент. Неприменимое состояние помечается `note`, а не пропускается. Витрина есть в dev и
демо-сборке, но не попадает в сборку `--mode cms`. Страницы из вложенных папок `app/pages`
выводятся с префиксом папки: `pages/dev/ui.html` → `dev-ui.html`.

## Optional project libraries

Swiper, Inputmask и другие библиотеки не входят в стартер. Устанавливайте их только когда
они реально используются проектом:

```sh
npm install swiper
npm install inputmask
```

Импорт и cleanup должны принадлежать конкретному компоненту. Для Swiper храните instance
и вызывайте `instance.destroy(true, true)` в disposer. Для Inputmask удаляйте созданную
маску через `element.inputmask?.remove()`.

Не добавляйте optional-библиотеки в starter «на будущее».

## Оптимизация изображений

Сборка не сжимает и не перекодирует изображения автоматически. Оптимизируйте исходные
PNG/JPEG/WebP/AVIF до коммита или добавляйте отдельный проектный скрипт на базе `sharp`.

Не возвращайте `vite-plugin-imagemin`: plugin устаревал, усложнял чистую установку и делал
результат build зависимым от нативных бинарников. Если проекту нужна автоматизация,
предпочтительнее явный reproducible prebuild-скрипт.

## Проверка перед передачей проекта

```sh
rm -rf node_modules dist
npm ci
npm run build
BASE=/demo/ npm run build
BASE=/bitrix/templates/<шаблон>/ npm run build -- --mode cms
npm audit --omit=dev
npm audit
npm ls
```
