// Чистая логика экрана «Деньги на полках». Типы ответа RPC get_inventory_overview
// и производная маржа (защита от деления на ноль).

/** Строка топа товаров (что продаётся). */
export interface TopProduct {
  product_id: string;
  name: string | null;
  code: string | null;
  qty: number;
  revenue: number;
  profit: number;
}

/** Строка мёртвого стока (есть остаток, нет продаж за период). */
export interface DeadProduct {
  product_id: string;
  name: string | null;
  code: string | null;
  stock: number;
  /** Дней без продаж (today − последняя продажа). null — товар не продавался ни разу. */
  days_no_sale: number | null;
  /** Замороженная сумма = остаток × закупка из последней продажи. */
  frozen: number;
}

export interface InventoryKpi {
  inStockCount: number;
  deadCount: number;
  frozenCapital: number;
}

export interface InventoryOverview {
  top: TopProduct[];
  dead: DeadProduct[];
  kpi: InventoryKpi;
}

/** Маржа в % (прибыль / выручка). 0 при нулевой выручке — без NaN. */
export function margin(revenue: number, profit: number): number {
  return revenue > 0 ? (profit / revenue) * 100 : 0;
}
