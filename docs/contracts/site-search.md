# Контракт: поиск в шапке

Вёрстка: `app/components/layouts/SiteSearch` (поле, окно, подсказки), фильтры —
`sections/search/SearchFilter` (те же, что на странице результатов, docs/contracts/search.md).
Настройки — `site.search` в `site.config.json`, запрос — `header.search.value` страницы.
Витрина: `/dev/ui.html#story=site-search`, `#story=header`.

## Поведение

- Поле 700 по центру шапки (до 1024 — строка под шапкой). Фокус — окно: слева «Искать в
  разделе» (до 1024 — лента вкладок), справа фильтры раздела в 2 колонки (до 1024 — в столбик),
  «Сбросить все». Режима «Везде» нет, по умолчанию — Справочник. Недавние запросы не показываем.
- До 1024 окно на весь экран: поле и × сверху, вкладки, фильтры, подсказки, внизу закреплена
  «Все результаты в Справочнике · N». Таб-бар под окном, страница не прокручивается.
- Смена раздела — фильтры раздела с `filtersUrl` (скелетон, пока ждём). Запрос сохраняется,
  фильтры прошлого раздела не переносятся.
- Подсказки: с 2-го символа, через 300 мс после ввода, прошлый запрос отменяется, до 6 штук.
  Фильтр выбрали — подсказки и число пересчитываются сразу (кнопки «Применить» нет).
  До 1024 при вводе фильтры сворачиваются в строку «Фильтры: Юр. лицо: 1, Отдел: 2» (тап —
  развернуть).
- ↑↓ — по подсказкам, Enter — открыть выбранную; иначе Enter и «Все результаты · N» — страница
  результатов (`action`) с запросом, разделом и фильтрами в адресе. Esc и клик вне — закрыть.
- Без фокуса: в поле запрос и сводка «Справочник · 2 фильтра»; × на ней сбрасывает фильтры.
- Пусто: «По запросу «…» ничего не найдено», подсказка, «Сбросить фильтры» (если выбраны).
- Без JS — обычная GET-форма на страницу результатов.

## Форма

GET на `action` (страница результатов): `q`, `section` (радиокнопки: `directory`, `news`,
`documents`, `vacancies`), фильтры раздела — как на странице результатов (`department[]`,
`date_from`/`date_to`, `salary_from`/`salary_to` …). Пустые параметры в адрес не попадают.

## Что выводит бэк (site.search)

| Поле | Примечание |
| --- | --- |
| `action` | адрес страницы результатов |
| `suggestUrl` | подсказки (ниже) |
| `filtersUrl` | фильтры раздела (ниже) |
| `sections[]` | `value`, `text`, `where` («в Справочнике» — для кнопки на мобильном), `icon` (`profile`, `news`, `directory`, `case`), `checked` |
| `filters[]` | фильтры выбранного раздела — формат SearchFilter (search.md), со значениями из адреса |
| `placeholder` | «Начать поиск» |

## Подсказки: suggestUrl

GET `suggestUrl?q=иван&section=directory&department[]=2&ajax_call=y` — те же параметры, что у
формы, плюс `ajax_call=y` (как у стандартного `bitrix:search.title`). Два варианта ответа —
скрипт понимает оба по `Content-Type`:

**HTML (удобно для «Умного поиска», `arturgolubev.smartsearch`).** Шаблон компонента
`arturgolubev:search.title` (или своя обёртка над модулем) на AJAX-запрос отдаёт фрагмент:

```html
<div data-suggest-count="5">
  <ul>
    <li class="site-search__item">
      <a class="site-search__link" href="/company/personal/user/7/">
        <span class="site-search__preview site-search__preview--person">
          <img class="site-search__image" src="…40x40.jpg" srcset="…80x80.jpg 2x" width="40" height="40" alt="" loading="lazy" />
        </span>
        <span class="site-search__text">
          <span class="site-search__title"><mark>Иван</mark>ова Ольга Александровна</span>
          <span class="site-search__meta">Провизор · ООО «Адель Фарм» · Отдел продаж</span>
        </span>
      </a>
    </li>
  </ul>
</div>
```

- `data-suggest-count` — сколько найдено всего (для «Все результаты · N»), пунктов — до 6.
- Без картинки — `site-search__preview--{person|news|document|other|vacancy}` и значок из
  спрайта: `<svg class="icon site-search__preview-icon site-search__preview-icon--l"><use href="#icon-profile"/></svg>`
  (`--l` — для person/news/vacancy, 20px; document/other — 16px; значки `profile`, `news`,
  `case`, `document`, `chain`).
- Текст экранирует бэк (`htmlspecialchars`), совпадения — в `<mark>`.
- Стандартный JS компонента (JCTitleSearch) подключать не нужно: запросы, окно и клавиатуру
  ведёт наш скрипт. От модуля нужны поиск (морфология, раскладка, опечатки) и шаблон ответа.

**JSON (если бэку проще).**

```json
{ "count": 5, "items": [ { "url": "…", "type": "person", "image": "…40x40.jpg", "titleHtml": "<mark>Иван</mark>ова Ольга", "meta": "Провизор · …" } ] }
```

В JSON скрипт сам экранирует всё, кроме `<mark>`.

## Фильтры раздела: filtersUrl

GET `filtersUrl?section=news&ajax_call=y` → HTML фильтров раздела — тот же шаблон, что
`sections/search/SearchFilter` (Select с `multiple`, DateRange, NumberRange), без выбранных
значений. Скрипт вставляет фрагмент и сам подключает поведение (app.js монтирует модули).
Не пришло — «Фильтры раздела не загрузились», искать можно без них.

## Поиск по одним фильтрам

Выбраны фильтры, а запроса нет — внизу окна кнопка «Найти в <разделе>» (`[data-site-search-apply]`).
Она отправляет ту же GET-форму: на странице результатов `q` пустой, раздел и фильтры в адресе
(`?section=directory&company[]=1`). Бэк должен показывать выдачу по одним фильтрам.
