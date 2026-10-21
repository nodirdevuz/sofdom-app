// Чистая логика блока «Доход по дням»: типы + нормализация ответа RPC get_cashflow_by_day.
// Без побочных эффектов.

export interface CashflowDay {
  d: string;
  income: number;
  expense: number;
  diff: number;
}

export interface CashflowDayPoint {
  d: string;
  income: number;
}

export interface CashflowByDay {
  incomeTotal: number;
  expenseTotal: number;
  diffTotal: number;
  avgIncome: number;
  best: CashflowDayPoint | null;
  worst: CashflowDayPoint | null;
  days: CashflowDay[];
}

const obj = (x: unknown): Record<string, unknown> => (x ?? {}) as Record<string, unknown>;
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

function point(x: unknown): CashflowDayPoint | null {
  if (x == null) return null;
  const o = obj(x);
  return { d: String(o.d ?? ''), income: Number(o.income ?? 0) };
}

export function normalizeCashflow(data: unknown): CashflowByDay {
  const o = obj(data);
  return {
    incomeTotal: Number(o.income_total ?? 0),
    expenseTotal: Number(o.expense_total ?? 0),
    diffTotal: Number(o.diff_total ?? 0),
    avgIncome: Number(o.avg_income ?? 0),
    best: point(o.best),
    worst: point(o.worst),
    days: arr(o.days).map((x) => {
      const r = obj(x);
      return {
        d: String(r.d ?? ''),
        income: Number(r.income ?? 0),
        expense: Number(r.expense ?? 0),
        diff: Number(r.diff ?? 0),
      };
    }),
  };
}
