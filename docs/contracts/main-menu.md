# Контракт: мобильное меню и TabBar

Черновик для согласования с бэкендом (Битрикс). Вёрстка: `app/components/layouts/MainMenu`,
`app/components/layouts/TabBar`, подтверждение выхода — `app/components/components/Modal` (шторка до 768, окно по центру с 768).
Витрина: `/dev/ui.html#story=main-menu`, `#story=tab-bar`, `#story=modal`.

## Мобильное меню

Выводится один раз на странице (`id="main-menu"`), открывается бургером в шапке и пунктом
«Меню» в TabBar (`data-main-menu-open`, `aria-controls="main-menu"`). На десктопе не нужно.

| Поле | Где в разметке | Примечание |
| --- | --- | --- |
| Пользователь | `.main-menu__profile` | имя, должность, ссылка «Моя страница», фото 48×48 (96×96 для 2x) |
| Выход | `.main-menu__logout` → шторка, «Выйти» — ссылка `logout.url` | для Битрикса — `?logout=yes&sessid=…` |
| Разделы CRM и личного кабинета | `.main-menu__label` + `.main-menu__list` | подпись раздела и пункты с иконками (`.main-menu__row`), всегда раскрыты |
| Портал | `.main-menu__label` + `.main-menu__list` | те же пункты и подменю, что в меню шапки (одно меню в админке); пункт — `.main-menu__row` с иконкой |
| Пункт с подменю | `button.main-menu__toggle[data-main-menu-sub]` + `ul.main-menu__sub` | кнопка раскрывает второй уровень (`aria-expanded`, `aria-controls` = id списка, у свёрнутого списка `hidden`); раскрыт сразу — `expanded` (например, текущий раздел); пункты второго уровня — `.main-menu__sub-row`, без иконок |
| Текущая страница | `aria-current="page"` у пункта | фон BG.Info, текст Main Blue |
| Присоединяйтесь | `.main-menu__row[target=_blank]` | логотип 20×20, название, внешняя ссылка |

Разделы CRM показываются только тем, у кого есть доступ (в витрине — состояние «Без доступа
к CRM»). Иконки пунктов — имена из `app/assets/icons` (`home`, `pharmacy`, `manager`,
`calendar`, `tasks`, `edu`, `multiplier`, `box`, `apple`, `motivation` и т. д.).

## TabBar

До 767px, фиксирована внизу. Пункты — `items: [{ icon, text, url, current, menu }]`, первый —
«Меню» (`menu: true`). Набор зависит от доступа пользователя: «Меню · Кабинет · Новости ·
Обучение» или «Меню · Кабинет · Справочник · CRM». Текущий раздел — `current`.
