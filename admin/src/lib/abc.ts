// Чистая логика экрана «ABC-анализ». Типы ответа RPC get_abc_analysis и
// производные значения (маржа, нормализация процента для показа).
// Сортировку, накопительный % и классификацию A/B/C считает SQL.

/** Метрика классификации: по прибыли (по умолчанию) или по выручке. */
export type AbcMetric = 'profit' | 'revenue';

/** Группа вклада: A — ядро, B — середина, C — хвост. */
export type AbcGroup = 'A' | 'B' | 'C';

/** Порядок групп для рендера фильтров и карточек. */
export const ABC_GROUPS: readonly AbcGroup[] = ['A', 'B', 'C'] as const;

/** Строка рейтинга товаров. */
export interface AbcRow {
  product_id: string;
  name: string | null;
  code: string | null;
  qty: number;
  revenue: number;
  profit: number;
  /** Доля товара в выбранной метрике, %. */
  share: number;
  /** Накопительный % нарастающим итогом (0..100, см. clampPct). */
  cumulative: number;
  group: AbcGroup;
}

/** Сводка по группе для KPI-карточки. */
export interface AbcGroupSummary {
  count: number;
  /** Доля группы в выбранной метрике, %. */
  pct: number;
}

export interface AbcOverview {
  metric: AbcMetric;
  totals: { revenue: number; profit: number; products: number };
  groups: Record<AbcGroup, AbcGroupSummary>;
  rows: AbcRow[];
}

/** Маржа в % (прибыль / выручка). 0 при нулевой выручке — без NaN. */
export function margin(revenue: number, profit: number): number {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}

/**
 * Накопительный % для показа в таблице. В режиме «прибыль» убыточные товары
 * (проданные ниже закупки) идут в хвост и формально задирают кумулятив выше
 * 100% — для пользователя ограничиваем диапазоном 0..100.
 */
export function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}
