// Логика выбора периода для экрана «Пульс бизнеса».
// Чистые функции без побочных эффектов (кроме чтения текущего времени в
// todayTashkent) — удобно тестировать и переиспользовать.
//
// Даты представлены строками 'YYYY-MM-DD' (календарные, без времени и зоны).
// Диапазон полуоткрытый: [from; to) — `to` исключительно. Это снимает вопросы
// с границей суток и совпадает с сигнатурой RPC get_sales_dashboard.

import type { TFunc } from '../i18n';

export type PeriodPreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'last60'
  | 'last90'
  | 'last365'
  | 'custom';

/** Полуоткрытый диапазон календарных дат [from; to). */
export interface DateRange {
  from: string;
  to: string;
}

/** Текущий период и предыдущий той же длины (для сравнения «↑12% vs прошлый»). */
export interface ResolvedPeriod {
  current: DateRange;
  previous: DateRange;
}

const TZ = 'Asia/Tashkent';

/** Сегодняшняя календарная дата в Asia/Tashkent как 'YYYY-MM-DD'. */
export function todayTashkent(): string {
  // en-CA даёт формат YYYY-MM-DD; timeZone сдвигает к местному дню Ташкента.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Прибавляет `days` к календарной дате 'YYYY-MM-DD' (через UTC, без дрейфа зоны). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Число календарных дней в диапазоне [from; to). */
export function rangeLengthDays(range: DateRange): number {
  const [fy, fm, fd] = range.from.split('-').map(Number);
  const [ty, tm, td] = range.to.split('-').map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / 86_400_000);
}

/**
 * Текущий диапазон по пресету (или пользовательскому диапазону) + предыдущий
 * диапазон такой же длины, идущий встык перед текущим.
 *
 * `custom.to` — включительная дата из date-picker; переводим в исключительную (+1 день).
 * По умолчанию (resolvePeriod без аргументов) — последние 30 дней.
 */
export function resolvePeriod(
  preset: PeriodPreset = 'last30',
  custom?: DateRange,
): ResolvedPeriod {
  const today = todayTashkent();
  let current: DateRange;

  switch (preset) {
    case 'today':
      current = { from: today, to: addDays(today, 1) };
      break;
    case 'yesterday':
      current = { from: addDays(today, -1), to: today };
      break;
    case 'last7':
      current = { from: addDays(today, -6), to: addDays(today, 1) };
      break;
    case 'last30':
      current = { from: addDays(today, -29), to: addDays(today, 1) };
      break;
    case 'last60':
      current = { from: addDays(today, -59), to: addDays(today, 1) };
      break;
    case 'last90':
      current = { from: addDays(today, -89), to: addDays(today, 1) };
      break;
    case 'last365':
      current = { from: addDays(today, -364), to: addDays(today, 1) };
      break;
    case 'custom':
      current = custom
        ? { from: custom.from, to: addDays(custom.to, 1) }
        : { from: addDays(today, -29), to: addDays(today, 1) };
      break;
  }

  const length = rangeLengthDays(current);
  const previous: DateRange = {
    from: addDays(current.from, -length),
    to: current.from,
  };

  return { current, previous };
}

/**
 * Подпись периода для подзаголовка. Пресеты переводятся через t; кастомный
 * диапазон показывается числами «05.06 — 24.06» — без локализации месяцев.
 */
export function periodLabel(preset: PeriodPreset, period: ResolvedPeriod, t: TFunc): string {
  switch (preset) {
    case 'today':
      return t('period.today');
    case 'yesterday':
      return t('period.yesterday');
    case 'last7':
      return t('period.last7');
    case 'last30':
      return t('period.last30');
    case 'last60':
      return t('period.last60');
    case 'last90':
      return t('period.last90');
    case 'last365':
      return t('period.last365');
    case 'custom':
      // to исключительно → последний показанный день = to - 1.
      return `${formatDM(period.current.from)} — ${formatDM(addDays(period.current.to, -1))}`;
  }
}

/** '2026-06-05' → '05.06'. */
function formatDM(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}.${m}`;
}
