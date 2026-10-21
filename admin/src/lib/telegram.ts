// Обёртка над Telegram WebApp SDK (telegram-web-app.js подключён в index.html).
// Паттерны взяты из проекта Delivery (client-twa/lib/telegram.ts): все вызовы с мягкой
// деградацией — в обычном браузере и на старых клиентах Telegram тихо ничего не делают.

interface TgWebApp {
  ready: () => void;
  expand: () => void;
  // Bot API 6.1+/6.9+/7.10+ — цвет фона вебвью, системной шапки и нижней полосы Telegram.
  setBackgroundColor?: (color: string) => void;
  setHeaderColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  // Высота вьюпорта (px). viewportStableHeight — без учёта временных панелей (клавиатура и т.п.).
  viewportHeight?: number;
  viewportStableHeight?: number;
  onEvent?: (event: string, cb: () => void) => void;
  // Bot API 8.0+ — полноэкранный режим: контент на весь экран, системная шапка Telegram
  // становится полупрозрачным оверлеем поверх. На старых клиентах методов/событий нет.
  requestFullscreen?: () => void;
  isFullscreen?: boolean;
  // Инсеты безопасной зоны (Bot API 8.0+): устройство (вырез/статус-бар) и контент (плавающие
  // кнопки Telegram «Закрыть/⋯»). В fullscreen их нужно учитывать вручную — CSS env() их не видит.
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  // Bot API 7.7+ — системный свайп-вниз сворачивает/закрывает приложение; отключаем при скролле.
  disableVerticalSwipes?: () => void;
  // Подтверждение закрытия — случайный свайп/тап не выбросит сотрудника из табеля.
  enableClosingConfirmation?: () => void;
  version?: string;
  isVersionAtLeast?: (version: string) => boolean;
  HapticFeedback?: {
    impactOccurred: (s: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred: (t: 'error' | 'success' | 'warning') => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

const tg = (): TgWebApp | null => window.Telegram?.WebApp ?? null;

/** true, когда приложение открыто внутри Telegram (Mini App), а не в обычном браузере. */
export function isTelegram(): boolean {
  return !!tg();
}

/** Инициализация окна Mini App при старте приложения. Вне Telegram — no-op. */
export function initTelegram(): void {
  const w = tg();
  if (!w) return;
  w.ready();
  // Развернуть на полную высоту сразу при открытии: убирает «полуоткрытое» состояние.
  w.expand();
  // Непрозрачный «верх»: красим системную шапку Telegram и фон вебвью под тёмную шапку
  // приложения (#1f2937 — как theme-color в index.html). Иначе над контентом остаётся
  // прозрачная/серая полоса, сквозь которую видно чат. На старых клиентах методов нет — пропуск.
  if (typeof w.setBackgroundColor === 'function') w.setBackgroundColor('#1f2937');
  w.setHeaderColor?.('#1f2937');
  // Bot API 7.7+: запрещаем системный свайп-вниз — скролл таблиц никогда не закроет приложение;
  // закрыть можно только через системную шапку Telegram. На старых клиентах метода нет — пропуск.
  if (typeof w.disableVerticalSwipes === 'function') w.disableVerticalSwipes();
  // Telegram спросит «точно закрыть?» при попытке закрытия.
  w.enableClosingConfirmation?.();
  setupFullscreen(w);
  setupSafeArea(w);
  // Реальная высота вьюпорта Telegram → CSS-переменная --tg-vh (потребляет Layout). 100vh в
  // вебвью привязан к layout-viewport до expand, из-за чего снизу обрезается контент.
  const syncViewportHeight = () => {
    const h = w.viewportStableHeight || w.viewportHeight || window.innerHeight;
    if (h) document.documentElement.style.setProperty('--tg-vh', `${Math.round(h)}px`);
  };
  syncViewportHeight();
  if (typeof w.onEvent === 'function') w.onEvent('viewportChanged', syncViewportHeight);
}

/**
 * В fullscreen контент уходит ПОД вырез устройства и ПОД плавающие кнопки Telegram («Закрыть/⋯»).
 * CSS env(safe-area-inset-*) видит только вырез, но НЕ кнопки Telegram — поэтому суммарный отступ
 * считаем сами (safeAreaInset + contentSafeAreaInset) и кладём в --safe-top/--safe-bottom
 * (их потребляют Layout и Login). Вне fullscreen переменные снимаем — поведение как раньше.
 */
function syncSafeArea(w: TgWebApp): void {
  const style = document.documentElement.style;
  if (w.isFullscreen === true) {
    const top = (w.safeAreaInset?.top ?? 0) + (w.contentSafeAreaInset?.top ?? 0);
    const bottom = (w.safeAreaInset?.bottom ?? 0) + (w.contentSafeAreaInset?.bottom ?? 0);
    style.setProperty('--safe-top', `${Math.round(top)}px`);
    style.setProperty('--safe-bottom', `${Math.round(bottom)}px`);
  } else {
    style.removeProperty('--safe-top');
    style.removeProperty('--safe-bottom');
  }
}

/** Подписка на изменения инсетов/режима fullscreen + первичный расчёт. На старых клиентах onEvent нет. */
function setupSafeArea(w: TgWebApp): void {
  if (typeof w.onEvent === 'function') {
    w.onEvent('safeAreaChanged', () => syncSafeArea(w));
    w.onEvent('contentSafeAreaChanged', () => syncSafeArea(w));
    w.onEvent('fullscreenChanged', () => syncSafeArea(w));
  }
  syncSafeArea(w);
}

/** Запрос fullscreen (Bot API 8.0+). Guard по методу+версии; отказ клиента ловим через fullscreenFailed
 *  и try/catch — тогда просто остаёмся на expand() (вызван выше), приложение не ломается. */
function setupFullscreen(w: TgWebApp): void {
  if (typeof w.requestFullscreen !== 'function' || !(w.isVersionAtLeast?.('8.0') ?? false)) return;
  if (typeof w.onEvent === 'function') w.onEvent('fullscreenFailed', () => syncSafeArea(w));
  try {
    w.requestFullscreen();
  } catch {
    /* старый клиент / отказ — тихо остаёмся на expand() */
  }
}

// ─── Тактильная отдача (haptic feedback) ─────────────────────────────────────

export function haptic(type: 'light' | 'medium' | 'heavy' = 'light'): void {
  tg()?.HapticFeedback?.impactOccurred(type);
}

/** Тактильный отклик «успех» (вход выполнен и т.п.). */
export function hapticSuccess(): void {
  tg()?.HapticFeedback?.notificationOccurred('success');
}

/** Тактильный отклик «ошибка» (неверный логин/пароль и т.п.). */
export function hapticError(): void {
  tg()?.HapticFeedback?.notificationOccurred('error');
}
