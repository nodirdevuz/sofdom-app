// Чистая логика экрана «Товарная аналитика». Типы ответа RPC get_product_sales
// и производные (маржа, Δ выручки к прошлому периоду).

export interface ProductSalesRow {
  product_id: string;
  name: string | null;
  code: string | null;
  qty: number;
  receipts: number;
  revenue: number;
  profit: number;
  avgPrice: number;
  /** Выручка за прошлый период (null — сравнение выключено или товар тогда не продавался). */
  prevRevenue: number | null;
  prevQty: number | null;
}

export interface ProductSalesTotals {
  products: number;
  qty: number;
  revenue: number;
  profit: number;
  receipts: number;
}

export interface ProductSalesOverview {
  hasPrev: boolean;
  totals: ProductSalesTotals;
  rows: ProductSalesRow[];
}

/** Колонки, по которым можно сортировать таблицу. */
export type ProductSortKey = 'name' | 'qty' | 'receipts' | 'revenue' | 'profit' | 'margin' | 'avgPrice';

/** Сколько строк показывать: топ-30, топ-100 или все. */
export type TopN = 30 | 100 | 'all';

/** Маржа в % (прибыль / выручка). 0 при нулевой выручке — без NaN. */
export function margin(revenue: number, profit: number): number {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}

/** Δ% выручки к прошлому периоду; null — если сравнения нет или прошлая выручка ≤ 0. */
export function revenueDelta(row: ProductSalesRow): number | null {
  if (row.prevRevenue == null || row.prevRevenue <= 0) return null;
  return ((row.revenue - row.prevRevenue) / row.prevRevenue) * 100;
}
