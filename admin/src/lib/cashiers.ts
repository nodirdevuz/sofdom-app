// Чистая логика экрана «Кассиры»: производные метрики по кассирам, мерж
// возвратов и итоги. Без побочных эффектов — легко тестировать.
//
// Деления защищены от нуля (период без продаж → 0, а не NaN).

/** «Сырая» строка кассира из RPC get_cashiers_summary. */
export interface CashierRaw {
  cashier: string | null;
  receipts: number;
  lines: number;
  revenue: number;
  profit: number;
  cash: number;
  card: number;
}

/** Возврат по кассиру (reason='Возврат'). */
export interface CashierReturn {
  cashier: string | null;
  amount: number;
}

/** Расход по кассиру (всё кроме reason='Возврат'). */
export interface CashierExpense {
  cashier: string | null;
  amount: number;
}

/** Агрегаты расхода кассы из RPC get_cash_expenses. */
export interface ExpensesSummary {
  total: number;
  byCategory: { reason: string; amount: number }[];
  byDay: { d: string; amount: number }[];
  returnsByCashier: CashierReturn[];
  expensesByCashier: CashierExpense[];
}

/** Строка кассира с производными метриками и возвратами. */
export interface CashierRow extends CashierRaw {
  avgCheck: number;
  upt: number;
  /** Сумма возвратов (расход reason='Возврат'), привязанных к этому кассиру. */
  returns: number;
  /** Суммарный расход кассира за период (всё кроме возвратов). */
  expenses: number;
  /** Служебная псевдо-касса (например «Приход») — не настоящий кассир. */
  isService: boolean;
}

/** Итоги по группе кассиров (для строки «Итого»). */
export interface CashierTotals {
  receipts: number;
  lines: number;
  revenue: number;
  profit: number;
  cash: number;
  card: number;
  returns: number;
  expenses: number;
  avgCheck: number;
  upt: number;
}

/** Служебные значения cashier, которые не являются реальными кассирами. */
export const SERVICE_CASHIERS = ['Приход'];

export function isServiceCashier(name: string | null): boolean {
  return name != null && SERVICE_CASHIERS.includes(name);
}

/** Достраивает сырые строки: средний чек, UPT, возвраты, расход, флаг служебной. */
export function buildCashierRows(
  raw: CashierRaw[],
  returns: CashierReturn[],
  expenses: CashierExpense[],
): CashierRow[] {
  const returnsByCashier = new Map<string, number>();
  for (const r of returns) {
    if (r.cashier != null) returnsByCashier.set(r.cashier, r.amount);
  }
  const expensesByCashier = new Map<string, number>();
  for (const e of expenses) {
    if (e.cashier != null) expensesByCashier.set(e.cashier, e.amount);
  }

  return raw.map((r) => ({
    ...r,
    avgCheck: r.receipts > 0 ? r.revenue / r.receipts : 0,
    upt: r.receipts > 0 ? r.lines / r.receipts : 0,
    returns: r.cashier != null ? (returnsByCashier.get(r.cashier) ?? 0) : 0,
    expenses: r.cashier != null ? (expensesByCashier.get(r.cashier) ?? 0) : 0,
    isService: isServiceCashier(r.cashier),
  }));
}

/** Считает итоги по переданным строкам (вызывается уже без служебных). */
export function computeTotals(rows: CashierRow[]): CashierTotals {
  const sum = (pick: (r: CashierRow) => number) => rows.reduce((acc, r) => acc + pick(r), 0);

  const receipts = sum((r) => r.receipts);
  const revenue = sum((r) => r.revenue);
  const lines = sum((r) => r.lines);

  return {
    receipts,
    lines,
    revenue,
    profit: sum((r) => r.profit),
    cash: sum((r) => r.cash),
    card: sum((r) => r.card),
    returns: sum((r) => r.returns),
    expenses: sum((r) => r.expenses),
    avgCheck: receipts > 0 ? revenue / receipts : 0,
    upt: receipts > 0 ? lines / receipts : 0,
  };
}
