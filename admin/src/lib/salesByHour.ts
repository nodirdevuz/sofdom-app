// Чистая логика экрана «Продажи по часам». Типы ответа RPC get_sales_by_hour
// и помощники для тепловой карты (метки часов/дней, порядок, значение ячейки).

import type { TranslationKey } from '../i18n/dictionaries/ru';

/** Метрика тепловой карты: выручка или число чеков. */
export type HourMetric = 'revenue' | 'receipts';

/** Ячейка час × день недели (dow: isodow 1=Пн … 7=Вс). */
export interface HourCell {
  hour: number;
  dow: number;
  revenue: number;
  profit: number;
  receipts: number;
}

/** Профиль часа (агрегат по всем дням периода). */
export interface HourBucket {
  hour: number;
  revenue: number;
  profit: number;
  receipts: number;
  /** Выручка в этот час на типичный день периода. */
  avgRevenue: number;
}

/** Профиль дня недели. */
export interface DowBucket {
  dow: number;
  revenue: number;
  profit: number;
  receipts: number;
}

export interface SalesByHourKpi {
  bestHour: number | null;
  bestHourProfit: number;
  bestDow: number | null;
  bestDowProfit: number;
  avgHourRevenue: number;
  totalRevenue: number;
}

export interface SalesByHourOverview {
  cells: HourCell[];
  byHour: HourBucket[];
  byDow: DowBucket[];
  kpi: SalesByHourKpi;
}

/** Дни недели в порядке Пн→Вс (isodow). */
export const DOW_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

const DOW_SHORT: Record<number, TranslationKey> = {
  1: 'dow.mon', 2: 'dow.tue', 3: 'dow.wed', 4: 'dow.thu', 5: 'dow.fri', 6: 'dow.sat', 7: 'dow.sun',
};
const DOW_FULL: Record<number, TranslationKey> = {
  1: 'dow_full.mon', 2: 'dow_full.tue', 3: 'dow_full.wed', 4: 'dow_full.thu',
  5: 'dow_full.fri', 6: 'dow_full.sat', 7: 'dow_full.sun',
};

/** Ключ короткой подписи дня недели (Пн…Вс) для шапки тепловой карты. */
export function dowShortKey(dow: number): TranslationKey {
  return DOW_SHORT[dow] ?? 'dow.mon';
}

/** Ключ полной подписи дня недели для KPI. null — если дня нет (пустой период). */
export function dowFullKey(dow: number | null): TranslationKey | null {
  return dow == null ? null : DOW_FULL[dow] ?? null;
}

/** Час → '18:00'. */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/** Порядок показа часов: полночь (0) идёт после 23 — конец рабочего дня магазина. */
export function hourSortValue(hour: number): number {
  return hour === 0 ? 24 : hour;
}

/** Значение ячейки по выбранной метрике (0, если ячейки нет). */
export function cellMetric(cell: HourCell | undefined, metric: HourMetric): number {
  if (!cell) return 0;
  return metric === 'revenue' ? cell.revenue : cell.receipts;
}
