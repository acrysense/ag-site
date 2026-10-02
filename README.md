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
`canonical`. Ключ `data` из него доступен в шаблоне как `data` — так в витрину и статичные
страницы попадает демо-контент:

```hbs
{{> sections/home/NewsFeed/NewsFeed props=data.news }}
```

Полезные helpers уже доступны в шаблонах: `asset`, `attrs`, `default`, `obj`, `arr`,
`and`, `or`, `eq`, `cls`, `json`, `striptags`, `isSet`, `isEmpty`, `not`.

Для URL в ручной разметке используйте helper `asset`:

```hbs
<img src="{{asset '/assets/images/example.webp'}}" alt="" />
```

Helper `attrs` автоматически обрабатывает URL-подобные атрибуты и `srcset` в объектах.

## Флаги страницы (`<страница>.page.json`)

- `"auth": true` — вид для вошедшего: шапка `site.headerUser` (аватар и меню под ним), мобильное
  меню `site.mainMenu` (профиль, CRM, кабинет). Без флага — гость: `site.header` («Войти в ЛК») и
  `site.mainMenuGuest` (карточка входа вместо профиля, без разделов кабинета).
- `"extends": "index"` — данные другой страницы (поверх — свои поля и `data`).
- `"robots": "noindex"` — служебная страница не индексируется.

Главная в двух видах: `index.html` (гость) и `index-user.html` (вошедший) — общее тело в
`layouts/HomePage`.

## Навигация по страницам вёрстки

Для показа: **страница «Страницы вёрстки»** — `/dev/pages.html` в dev, `dev-pages.html` в сборке и в
демо (https://acrysense.github.io/ag-site/dev-pages.html) — все страницы по разделам; карточка
открывает страницу в новой вкладке, значок в углу копирует ссылку, «Скопировать все ссылки» — списком
«Название — адрес». На самих страницах — **кнопка «Страницы»** справа внизу: тот же список, текущая
отмечена, длинный список прокручивается внутри (SimpleBar); `?nav=0` в адресе прячет её (для
скриншотов). Ссылки на витрину компонентов в навигации пока нет (`showcaseUrl` в
`pagesIndexPlugin`).

Список строится сам из `app/pages/*.html`; раздел, название и порядок — поле `nav` в
`<page>.page.json`:

```json
"nav": { "group": "Разделы", "title": "Новости холдинга", "order": 20, "note": "" }
```

Без `nav` страница попадает в «Прочее» с заголовком из `title`. В демо в списке только выложенные
страницы; в сборку для CMS не попадают ни список, ни кнопка. Устроено переносимо (для других
сборок на этом же стартере): плагин `pagesIndexPlugin` в `vite.config.ts`, `app/pages/dev/pages.*`,
`app/pages/dev/pages-nav.*` и две строки в `layouts/Head`.

## Демо на GitHub Pages

https://acrysense.github.io/ag-site/ — выкладываются только проверенные страницы:

```sh
npm run deploy:pages -- index index-user search
```

Скрипт собирает сайт с `BASE=/ag-site/`, `SITE_URL` (полные адреса для превью ссылок) и
`DEMO_NOINDEX=1` (демо не попадает в поиск, превью ссылок работают), оставляет перечисленные страницы (имя файла без
`.html`) и отправляет их в ветку `gh-pages`; рабочая ветка не переключается. Каждая выкладка
заменяет прошлую — перечисляйте все страницы, которые должны остаться.

## Выкладка в репозиторий клиента (natix)

Одна папка — два репозитория, как в `ag`: GitHub (`origin`, разработка) и
`git.natix.ru/…/my.ag-html-v2` (remote `natix`, ветка `master`, нужен VPN). В natix уходят
исходники и сборка под Битрикс (`BASE=/bitrix/templates/ag-site/`, `--mode cms`) поверх его
истории — без force-push:

```sh
npm run deploy:natix -- --dry-run   # собрать и показать разницу, ничего не отправлять
npm run deploy:natix                # то же + подтверждение и пуш
```

Ветка natix выгружается в `.deploy/natix` (git worktree, игнорируется). Служебные файлы
(`.github`, `.claude`, настройки редактора, деплой-скрипты) в natix не уезжают; `dist` у natix в
`.gitignore` — добавляется принудительно. Перед выкладкой `main` должна совпадать с GitHub.

## SVG sprite

Положите отдельные SVG-иконки в `app/assets/icons`. Локальный plugin собирает их в файл
`assets/icons/sprite.svg` (в dev его отдаёт сервер, в сборке он лежит в `dist`). Иконка в разметке —
`<use href="…/assets/icons/sprite.svg#icon-имя">`: рисуется без JS, файл кешируется браузером.
В шаблоне Битрикса — тот же файл из папки шаблона.

Путь к спрайту для иконок, которые создаёт JS (`utils/icon.js`), — в `<html data-icons="…/sprite.svg">`.
Предзагрузку (`<link rel="preload">`) спрайту не ставим: для `<use>` браузер её не использует и
скачивает файл второй раз.

ID символа строится из относительного пути:

```text
app/assets/icons/close.svg       -> icon-close
app/assets/icons/social/mail.svg -> icon-social-mail
```

Использование — через partial, чтобы способ вывода иконок менялся в одном месте:

```hbs
{{> components/Icon/Icon name="close" class="btn__icon"}}
```

Иконки готовятся под `currentColor`: без зашитого `fill`, цвет задаёт CSS.

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

Шрифт можно разбить на наборы символов: последнее слово имени файла — набор
(`Inter-Variable-cyrillic.woff2`, `Inter-Variable-latin.woff2`), диапазон символов — в `subsets`
в `fonts.config.json`. Генератор добавит `unicode-range`, и браузер скачает только те файлы,
символы которых есть на странице. Inter так и подключён: файлы наборов взяты с Google Fonts.

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

## Цвета, текст и шрифты

Все значения взяты из переменных макета в Figma и объявлены один раз в
`app/assets/styles/base/_vars.scss`, рядом с каждым — имя переменной в Figma:

- `$colors` — цвета, в коде `palette("main-blue")`. Переменные с одинаковым значением и
  именем на двух языках (`White` / `Белый`) сведены в одну.
- `$text-styles` — стили текста, в коде `@include text("m-400")`. Размеры фиксированные, как
  в макете. Мобильные стили Figma (`360/…`) — отдельные записи с суффиксом `-360`: на одном
  мобильном экране встречаются и они, и десктопные, поэтому блок выбирает стиль сам.
  `line-height` «100» в переменных Figma — это Auto, в CSS `normal`.
- `$radius-button`, `$radius-content-block`, `$radius-inner-block` — скругления,
  `$shadow-content-block` — тень белых блоков, `$container-width` — ширина контента (1600).

```scss
.news-card__title {
	@include text("h4-360");
	color: palette("black-h");

	@include up(desktop) {
		@include text("card-title");
	}
}
```

Неизвестное имя цвета или стиля останавливает сборку с ошибкой. Как задаются размеры текста,
решает только миксин `text` в `_mixins.scss`: подход меняется в одном месте, блоки не трогаются.

Шрифты: Inter (переменный, OFL) и RF Rufo Bold — из проекта `ag`. RF Rufo — платный шрифт,
лицензия заказчика разрешает хранить его в репозитории. Подключены только начертания из
переменных макета.

## Контракты с бэкендом

Перед интеграцией блока в Битрикс его разметка, поля админки и обмен с сервером описываются в
`docs/contracts/<блок>.md` и согласуются с бэкендом.

## Витрина компонентов

Своя витрина в духе Storybook, без отдельных зависимостей. Запуск — `npm run ui`
(или `npm run dev` и адрес `/dev/ui.html`), в сборке — `dev-ui.html`.

Слева меню по группам: у выбранного компонента раскрываются его состояния («Шапка → Гость,
Вошёл, …»). В телефоне 360px показывается только выбранное состояние, без подписей; справа —
описание и список состояний, неприменимые — серым с пояснением. Планшет и десктоп —
«Открыть отдельно» (открывает то же состояние) и ширина окна. Выбор хранится в адресе
(`#story=header&state=1`), ссылку можно отправить.

- `app/pages/dev/ui.html` — оболочка: меню, панель ширин, iframe.
- `app/pages/dev/canvas.html` — холст со всеми историями. Оболочка открывает его с
  `?story=<id>&state=<n>`, поэтому медиазапросы работают по-настоящему. Истории рендерятся теми же
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
