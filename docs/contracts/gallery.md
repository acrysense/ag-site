# Контракт: фотогалерея

Черновик для согласования с бэкендом (Битрикс). Страницы: `app/pages/gallery.html` (список
альбомов), `app/pages/gallery-album.html` (альбом). Блоки — `app/components/sections/gallery/*`,
просмотр фото — `components/PhotoViewer` (библиотека PhotoSwipe 5, MIT). Витрина:
`/dev/ui.html#story=album-list` (и `gallery-years`, `album-card`, `album-hero`, `album-photos`).

Макет: Figma, список — `4682:25610`, альбом — `4682:25741`, просмотр фото — `4682:25854`.
Мобильного макета нет — наше.

## Список альбомов

Сетка `page-columns page-columns--start`: слева `GalleryYears` (годы) и `SideBanner`, справа
`AlbumList` (класс `page-columns__main`).

| Блок | Поля |
| --- | --- |
| `GalleryYears` | `title`, `items[{ text, url, count, current }]` — «Все альбомы» и годы, обычные ссылки |
| `AlbumList` | `title`, `sort` (SortMenu), `featured`, `items[]`, `pagination` (`total` — «24 альбома»), `empty.text` |
| `AlbumFeatured` | `url`, `badge` («Новый альбом»), `title`, `date`, `dateText`, `countText` («148 фото»), `cover{src, srcset}`, `buttonText` |
| `AlbumCard` | `url`, `title`, `date` (2026-05-20), `dateText` («20 мая 2026»), `count`, `cover{src, srcset, alt}` |

Обложки: 390×260 (3:2), для 2x — 780×520; главный альбом — 1200×480 (2x — 2400×960). Обрезка
по центру — `object-fit: cover`. Какой альбом главный и есть ли метка — решает админ.

## Альбом

Справа — `AlbumHero` и `AlbumPhotos` в обёртке `page-columns__main album-page`.

| Блок | Поля |
| --- | --- |
| `AlbumHero` | `title`, `date`, `dateText`, `countText`, `text`, `cover{src, srcset}` (1240×440), `like` (LikeButton: `count`, `liked`, `url`), `download{url, size}` (архив альбома, «1,2 ГБ»), `url` (ссылка для копирования; пусто — адрес страницы) |
| `AlbumPhotos` | `title` (для просмотра), `step` (по сколько фото, 24), `photos[]`, `other{title, items[AlbumCard]}` |

### Фото альбома

Бэк выводит **все фото альбома JSON-ом** и **первые `step` фото разметкой**:

```html
<ul class="album-photos__grid" data-album-grid> … первые 24 AlbumPhoto … </ul>
<button class="btn btn--light btn--m album-photos__more" type="button" data-album-more hidden></button>
<script type="application/json" data-album-photos>[ { … }, … ]</script>
```

Фото в JSON и в разметке (`AlbumPhoto`):

| Поле | Что это |
| --- | --- |
| `id` | id фото |
| `src`, `srcset` | большое фото для просмотра (до 2400 по длинной стороне) |
| `width`, `height` | **размеры большого фото в пикселях** — обязательны (PhotoSwipe по ним раскладывает фото до загрузки; в Битриксе — `WIDTH`/`HEIGHT` файла) |
| `thumb`, `thumbSrcset` | превью для сетки и ленты миниатюр, 4:3 (293×220, 2x — 586×440) |
| `alt` | подпись (может быть пустой) |
| `likes`, `liked`, `likeUrl` | «Нравится» фото — как у LikeButton (POST `liked=Y/N`, `sessid`, ответ `{ count, liked }`) |
| `download` | ссылка «Скачать фото» (оригинал) |

JSON выводить через `json_encode(..., JSON_HEX_TAG | JSON_UNESCAPED_UNICODE)` — чтобы `</script>` в
подписи не закрыл тег.

«Показать ещё N фото» дорисовывает следующие `step` фото из JSON копией первой карточки — без
запросов к серверу.

Почему так (и почему 24):

- Бэку — один запрос фото альбома и один вывод; отдельного AJAX-обработчика для порций не нужно,
  страница кешируется компонентом целиком. Превью — `CFile::ResizeImageGet` (делается один раз,
  дальше из `/upload/resize_cache`).
- Тяжёлое — сами картинки, а они грузятся лениво (браузер качает превью, только когда фото
  на экране). JSON на 150 фото — около 30 КБ текста.
- Порция 24 делится на 2, 3 и 4 колонки — последний ряд всегда полный (телефон 2, планшет 3,
  десктоп 4 в ряд); это 2–3 экрана фото за нажатие. Просмотр листает весь альбом («Фото 18 из 148»), с лентой миниатюр.
«Нравится» в сетке и в просмотре — одна отметка. Для очень больших альбомов (больше ~500 фото)
JSON можно будет отдавать отдельным запросом — договоримся.

### Просмотр фото

Открывается нажатием на фото (без JS — ссылка на большое фото). Сверху — название альбома,
«Фото N из M», «Нравится», «Скачать», «Закрыть» (и Esc); по бокам стрелки (и клавиши ←/→);
снизу миниатюры. Увеличение — двойное нажатие, щипок, клик по фото. Фокус — внутри окна, после
закрытия — на фото, с которого открыли. До 1024 — без стрелок (свайп), до 768 — без миниатюр.

## Без JS

Ссылки на альбомы и фото работают; «Показать ещё» и просмотр — нет (видны первые `step` фото,
каждое открывается файлом).
