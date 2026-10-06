# Контракт: «Структура холдинга»

Черновик для согласования с бэкендом (Битрикс). Страницы: `app/pages/holding.html` (юрлица),
`holding-entity.html` (юрлицо), `holding-employee.html` (сотрудник). Блоки — `app/components/sections/holding/*`, общий — `components/PhotoStrip` (лента
фото, просмотр — `PhotoViewer` без «Нравится»). Витрина: `/dev/ui.html#story=holding-hero` (и
`holding-entities`, `entity-info`, `brand-card`, `entity-staff`, `employee-row`, `employee-profile`,
`entity-brief`, `employee-colleagues`, `photo-strip`).

На демо (GitHub Pages, natix) раздел пока скрыт: строки в `tools/published-pages.txt`
закомментированы.

## Страницы

Все три — `container page-inner`: хлебные крошки, ниже содержимое.

1. **Юрлица** — `page-sections`: `HoldingHero`, `HoldingEntities`.
2. **Юрлицо** — `page-columns page-columns--aside-end`: `EntityInfo`, боковая
   `page-columns__aside page-aside-cards` с `BrandCard` (по одной на бренд), `EntityStaff`.
   С 1024 бренды — колонка 350 справа на всю высоту, до 1024 — между карточкой и сотрудниками
   (на планшете по две в ряд). Брендов нет — боковой нет, место не остаётся.
3. **Сотрудник** — `page-columns page-columns--aside-start`: `EmployeeProfile`, боковая
   `page-columns__aside` с `EntityBrief`, `EmployeeColleagues`. С 1024 юрлицо — колонка 350
   слева.

Порядок в разметке — порядок на телефоне: первый блок основной колонки, боковая, остальные.

## Общие части

**`InfoList`** — строки «подпись: значение» (`dl`): `items[{ label, value, links[{ text, url }] }]`.
Пустая строка не выводится; несколько ссылок — через «; », номер телефона не переносится
посередине. `label` пишет бэк вместе с двоеточием («Телефон:»).

**`BrandChips`** — плашки брендов: `items[{ name, logo }]`, `label` (по умолчанию «Бренд» /
«Бренды» по числу), `emptyText` («Бренды уточняются» — пунктирная плашка, когда брендов нет).
Логотип — квадрат 28 (отдавать 56×56 для 2x).

**`EmployeeRow`** — сотрудник в списке: `name`, `url` (карточка), `position`, `head` (метка
«Руководитель», текст — `headText`), `photo` (48, отдавать 96×96), `phone{ text, url }`,
`email{ text, url }`. Вся строка — ссылка, телефон и e-mail — свои ссылки поверх. Нет фото —
инициалы (две буквы ФИО).

## Юрлица

**`HoldingHero`**

| Поле | Что это |
| --- | --- |
| `titleLines[]` | строки заголовка («Холдинг», «Аптека групп») — каждая с новой строки |
| `subtitle` | «Надежный партнер с 30-летней историей» |
| `stats[{ value, label }]` | цифры («11 — Юридических лиц»); нет — блок без них |
| `person{ name, role, photo{ src, srcset, alt } }` | председатель; нет — заголовок на всю ширину |

Фото председателя — обрезка по cover от верха, на 1920 — 790×335 (отдавать 1580×670).

**`HoldingEntities`** — `title`, `subtitle`, `items[]` (`EntityCard`). Все юрлица одной
страницей (их 11), без догрузки. Пусто — блока нет.

**`EntityCard`** — `name`, `url` (страница юрлица), `phones[{ text, url }]`, `address`,
`brands[{ name, logo }]`, `brandsLabel`, `moreText` (по умолчанию «Подробнее»).

## Юрлицо

**`EntityInfo`**

| Поле | Что это |
| --- | --- |
| `name` | название (H1 страницы) |
| `rows[]` | `InfoList`: «Адрес», «Телефон» (ссылки), «Бренды» (текстом через запятую) |
| `html` | описание из визуального редактора (модуль `.content`, обёртки не нужны) |
| `photos[]` | лента фото: `src` (большое для просмотра), `thumb`, `thumbSrcset`, `width`, `height`, `alt` |
| `hideText`, `showText` | «Скрыть описание» / «Показать описание» |

- Миниатюры — высотой 400 (на телефоне 240), ширина по пропорции `width/height`: отдавать
  миниатюру высотой 800 для 2x и настоящие `width`/`height` большого.
- «Скрыть описание» прячет описание и фото; состояние не запоминается. Без JS кнопки нет,
  описание открыто. Нет ни описания, ни фото — нет и кнопки.

**`BrandCard`** — `name`, `logo` (квадрат 120, отдавать 240×240), `rows[]` (`InfoList`:
телефон, сайт, e-mail), `social[{ icon, label, url }]` (`icon`: instagram, vk, facebook,
youtube, telegram, tiktok; `label` — для скринридера: «ADEL в Instagram»), `text`, `siteUrl`,
`siteText` (по умолчанию «Перейти на сайт»). Соцсети и сайт открываются в новой вкладке.

**`EntityStaff`**

| Поле | Что это |
| --- | --- |
| `title`, `summary` | «Сотрудники», «8 отделов · 48 сотрудников» (склонения — бэк) |
| `departments[]` | `id` (якорь, `dept-<id>`), `name`, `open`, `head` («Козлова Н.В.»), `count`, `avatars[]` (до 5 фото, 40 — отдавать 80×80), `employees[]` (`EmployeeRow`) |

- Отдел — `details/summary`: раскрывается без JS. Какой открыт — решает бэк (`open`), по
  умолчанию первый. Раскрытие не запоминается.
- Руководитель — первым в списке отдела, с `head: true`.
- «Все N сотрудников» у коллег ведёт на юрлицо к отделу: `?dept=<id>#dept-<id>` — по параметру
  бэк выводит этот отдел открытым (`open`), якорь прокручивает к нему.

## Сотрудник

**`EmployeeProfile`** — общий стиль для справочника, ЛК и CRM.

| Поле | Что это |
| --- | --- |
| `name` | ФИО (H1 страницы) |
| `photo{ src, srcset }` | квадрат 160 (на телефоне 96), отдавать 320×320; нет — инициалы |
| `meta[{ icon, text }]` | строки под ФИО: `profile` — должность, `case` — подразделение, `phone` — телефон |
| `sections[{ title, rows[{ label, value, url }] }]` | «Контакты», «Работа», «Личное»; `url` — значение ссылкой (телефон, e-mail, юрлицо, руководитель…) |

Пустая строка и раздел без строк не выводятся.

**`EntityBrief`** — `label` («Юридическое лицо»), `name`, `rows[]` (`InfoList`: телефон, адрес),
`brands[]`, `brandsLabel`, `staffUrl`, `staffText` («Все сотрудники юр. лица»).

**`EmployeeColleagues`** — `title`, `moreText` («Все 8 сотрудников»), `moreUrl`, `items[]`
(`EmployeeRow`). Пусто — блока нет; без `moreUrl` — без ссылки.
