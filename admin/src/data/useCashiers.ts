import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import type { ResolvedPeriod, DateRange } from '../lib/period';
import {
  buildCashierRows,
  type CashierRaw,
  type CashierRow,
  type ExpensesSummary,
} from '../lib/cashiers';

interface UseCashiersResult {
  rows: CashierRow[];
  expenses: ExpensesSummary | null;
  isLoading: boolean;
  error: string | null;
}

function normalizeRaw(row: unknown): CashierRaw {
  const o = (row ?? {}) as Record<string, unknown>;
  return {
    cashier: o.cashier == null ? null : String(o.cashier),
    receipts: Number(o.receipts ?? 0),
    lines: Number(o.lines ?? 0),
    revenue: Number(o.revenue ?? 0),
    profit: Number(o.profit ?? 0),
    cash: Number(o.cash ?? 0),
    card: Number(o.card ?? 0),
  };
}

function normalizeExpenses(data: unknown): ExpensesSummary {
  const o = (data ?? {}) as Record<string, unknown>;
  const arr = (key: string) => (Array.isArray(o[key]) ? (o[key] as unknown[]) : []);
  const obj = (x: unknown) => (x ?? {}) as Record<string, unknown>;
  return {
    total: Number(o.total ?? 0),
    byCategory: arr('by_category').map((x) => ({
      reason: String(obj(x).reason ?? ''),
      amount: Number(obj(x).amount ?? 0),
    })),
    byDay: arr('by_day').map((x) => ({ d: String(obj(x).d), amount: Number(obj(x).amount ?? 0) })),
    returnsByCashier: arr('returns_by_cashier').map((x) => ({
      cashier: obj(x).cashier == null ? null : String(obj(x).cashier),
      amount: Number(obj(x).amount ?? 0),
    })),
    expensesByCashier: arr('expenses_by_cashier').map((x) => ({
      cashier: obj(x).cashier == null ? null : String(obj(x).cashier),
      amount: Number(obj(x).amount ?? 0),
    })),
  };
}

/** Продажи по кассирам за период (RPC get_cashiers_summary). */
async function fetchSummary(range: DateRange): Promise<CashierRaw[]> {
  const { data, error } = await supabase.rpc('get_cashiers_summary', {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map(normalizeRaw);
}

/** Расход кассы за период (RPC get_cash_expenses). */
async function fetchExpenses(range: DateRange): Promise<ExpensesSummary> {
  const { data, error } = await supabase.rpc('get_cash_expenses', {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw new Error(error.message);
  return normalizeExpenses(data);
}

/**
 * Данные экрана «Кассиры»: продажи по кассирам + расход кассы за период.
 * Возвраты мержатся на строки кассиров; остальной расход — в блоке «Расходы».
 */
export function useCashiers(period: ResolvedPeriod): UseCashiersResult {
  const summary = useQuery({
    queryKey: ['cashiers', period.current.from, period.current.to],
    queryFn: () => fetchSummary(period.current),
  });
  const expenses = useQuery({
    queryKey: ['cash-expenses', period.current.from, period.current.to],
    queryFn: () => fetchExpenses(period.current),
  });

  const rows =
    summary.data && expenses.data
      ? buildCashierRows(summary.data, expenses.data.returnsByCashier, expenses.data.expensesByCashier)
      : [];

  return {
    rows,
    expenses: expenses.data ?? null,
    isLoading: summary.isLoading || expenses.isLoading,
    error: summary.error
      ? (summary.error as Error).message
      : expenses.error
        ? (expenses.error as Error).message
        : null,
  };
}
