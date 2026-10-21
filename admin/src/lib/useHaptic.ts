// Единая точка тактильной отдачи (haptic feedback) — порт хука из Delivery (useHaptic.ts).
//
// Зачем хук, а не прямые вызовы по коду: один импорт + один вызов на значимое действие,
// без дублирования `tg()?.HapticFeedback?...` по всему приложению. Семантика, а не «тип вибрации»:
//   • light   — лёгкий тап на значимом действии;
//   • medium  — главное действие (кнопка входа);
//   • success — успешный итог (вход выполнен);
//   • error   — ошибка/отказ (неверный логин/пароль).
//
// Мягкая деградация: вне Telegram (браузер/dev) или на старых клиентах без HapticFeedback
// вызовы тихо ничего не делают — обёртки из telegram.ts уже это гарантируют. Объект методов
// стабилен между рендерами (useMemo без зависимостей) — безопасно класть в deps эффектов.
import { useMemo } from 'react';
import { haptic, hapticSuccess, hapticError } from './telegram';

export interface Haptic {
  /** Лёгкий тап — второстепенное действие. */
  light: () => void;
  /** Среднее — главное действие (кнопка «Войти»). */
  medium: () => void;
  /** Успех — вход выполнен. */
  success: () => void;
  /** Ошибка — неверные данные, нет доступа. */
  error: () => void;
}

export function useHaptic(): Haptic {
  return useMemo<Haptic>(
    () => ({
      light: () => haptic('light'),
      medium: () => haptic('medium'),
      success: hapticSuccess,
      error: hapticError,
    }),
    [],
  );
}
