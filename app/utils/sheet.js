import { lockBody } from '@/utils/scroll-lock'

// До 768 (как $breakpoints tablet) всплывающие окна выбора — нижний лист на весь экран по ширине
// (стили — миксин sheet). Пока лист открыт, страница под ним не прокручивается.
const QUERY = '(max-width: 767.98px)'

export const isSheet = () => window.matchMedia(QUERY).matches

// Блокировка только в режиме листа; возвращает функцию снятия (или null)
export const lockIfSheet = () => (isSheet() ? lockBody() : null)
