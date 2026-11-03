# Контракт: плашка над шапкой

Вёрстка: `app/components/components/TopNotice` (та же плашка, что в ЛК). Выводится перед шапкой
(`layouts/Header`) на всех страницах. Витрина: `/dev/ui.html#story=top-notice`.

## Что выводит бэк

Одно объявление для всех сотрудников. Нет текста — блок не выводится (шапка сверху страницы).

```html
<section class="top-notice top-notice--warning" aria-label="Объявление" data-module="TopNotice"
         data-path="components" data-key="2026-11-03" data-cookie-name="ag_top_notice">
  <div class="top-notice__inner">
    <span class="top-notice__mark" aria-hidden="true">!</span>
    <p class="top-notice__text"><b class="top-notice__label">Важно:</b> текст объявления</p>
    <a class="top-notice__link" href="…">Подробнее →</a>
    <button class="top-notice__close" type="button" aria-label="Закрыть объявление" data-top-notice-close>
      <svg class="icon top-notice__close-icon" aria-hidden="true" focusable="false"><use href="…/sprite.svg#icon-close"></use></svg>
    </button>
  </div>
</section>
```

| Поле | Где в разметке | Обязательно | Примечание |
| --- | --- | --- | --- |
| Вид | класс `top-notice--warning` («Важно») или `top-notice--critical` («Критично») | нет | без класса — инфо |
| Ключ | `data-key` | да | меняется вместе с объявлением (дата или id): новое объявление показывается и тем, кто закрыл прошлое |
| Подпись | `.top-notice__label` | нет | жирная, перед текстом («Важно:») |
| Текст | `.top-notice__text` | да | обычный текст |
| Ссылка | `.top-notice__link` | нет | текст «Подробнее» правит админ, «→» — часть разметки |

Все поля правит админ.

## Закрытие

- Крестик сворачивает плашку и ставит cookie `ag_top_notice` = ключ (до конца дня, `Path=/`,
  `SameSite=Lax`, на https — `Secure`). Имя cookie можно поменять атрибутом `data-cookie-name`.
- Бэк не выводит плашку, если значение cookie совпадает с ключом текущего объявления. Если
  страница отдана из кеша с плашкой — скрипт спрячет её сам.
- Новое объявление (другой ключ) показывается всем, в том числе закрывшим прошлое.
