# Контракт: страница «Страница не найдена» (404)

Вёрстка: `app/components/sections/error/NotFound`, страница — `app/pages/404.html`.
Витрина: `/dev/ui.html#story=not-found`.

## Как подключить

Обычная страница шаблона: шапка, подвал, мобильное меню и нижняя панель как везде, без крошек.
Внутри `main`:

```html
<div class="container page-inner">
  <section class="not-found" aria-labelledby="not-found-title">
    <span class="not-found__decor" aria-hidden="true">404</span>
    <div class="not-found__wrapper">
      <h1 class="not-found__title" id="not-found-title">Страница не найдена</h1>
      <p class="not-found__description">Возможно, страница устарела или изменился её адрес.</p>
      <a class="btn btn--general btn--m not-found__btn" href="/">На главную</a>
    </div>
  </section>
</div>
```

- Ответ сервера — код 404 (`CHTTP::SetStatus("404 Not Found")` и `define("ERROR_404", "Y")`), а не
  200 с этой разметкой: иначе страница попадает в поиск.
- Классы те же, что у такого же блока в ЛК: разметку можно переносить между шаблонами.

| Поле | Где в разметке | Обязательно | Примечание |
| --- | --- | --- | --- |
| Код | `.not-found__decor` | да | «404», декоративный, скринридер его не читает |
| Заголовок | `.not-found__title` | да | `h1` |
| Пояснение | `.not-found__description` | нет | |
| Кнопка | `a.not-found__btn[href]` | нет | «На главную»; нет ссылки — кнопки нет |
