# Контракт: подвал

Черновик для согласования с бэкендом (Битрикс). Вёрстка: `app/components/layouts/Footer`.
Витрина: `/dev/ui.html#story=footer`.

| Поле | Где в разметке | Примечание |
| --- | --- | --- |
| Слоган | `.footer__slogan` | верхний регистр задаёт CSS |
| Соцсети | `.footer__social-link[target=_blank]` | иконка (`linkedin`, `telegram`), подпись необязательна («Переговорка») |
| Контакты | `.footer__contact` | `tel:` и `mailto:` ссылки, иконки `phone`, `mail` |
| «Предложить тему» | `.footer__suggest` | открывает окно «Предложить тему» (docs/contracts/form.md); без JS — ссылка |
| Копирайт | `.footer__copyright` | год — с сервера |
| Юридические ссылки | `.footer__legal-link` | 0…N ссылок |
| «Настройки cookie» | `button.footer__legal-link[data-cookie-settings]` | пункт среди юридических ссылок (после «Обработка cookie-файлов»), кнопка без адреса: снова показывает баннер согласия (docs/contracts/cookie-banner.md); текст правит админ |

Все поля правит админ (ТЗ: ничего не зашито). Пустые списки не выводятся.
