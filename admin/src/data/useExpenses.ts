import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import type { ResolvedPeriod, DateRange } from '../lib/period';
import {
  normalizeOverview,
  normalizeRecipients,
  normalizeRowsPage,
  type ExpensesOverview,
  type ExpenseRecipient,
  type ExpensesRowsPage,
  type ExpenseSort,
  type SortDir,
} from '../lib/expenses';

async function rpc<T>(fn: string, params: Record<string, unknown>, map: (d: unknown) => T): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message);
  return map(data);
}

/** KPI + график расхода за период. */
export function useExpensesOverview(period: ResolvedPeriod) {
  const r: DateRange = period.current;
  return useQuery<ExpensesOverview>({
    queryKey: ['expenses-overview', r.from, r.to],
    queryFn: () => rpc('get_expenses_overview', { p_from: r.from, p_to: r.to }, normalizeOverview),
  });
}

export interface RecipientsParams {
  limit?: number;
  reason?: string | null;
  debtsOnly?: boolean;
}

/** Топ получателей по note. */
export function useExpenseRecipients(period: ResolvedPeriod, params: RecipientsParams = {}) {
  const r = period.current;
  const { limit = 20, reason = null, debtsOnly = false } = params;
  return useQuery<ExpenseRecipient[]>({
    queryKey: ['expense-recipients', r.from, r.to, limit, reason, debtsOnly],
    queryFn: () =>
      rpc(
        'get_expense_recipients',
        { p_from: r.from, p_to: r.to, p_limit: limit, p_reason: reason, p_debts_only: debtsOnly },
        normalizeRecipients,
      ),
  });
}

export interface RowsParams {
  search?: string;
  reason?: string | null;
  cashier?: string | null;
  debtsOnly?: boolean;
  sort?: ExpenseSort;
  dir?: SortDir;
  limit?: number;
  offset?: number;
}

/** Страница таблицы расходов (серверный фильтр/сортировка/пагинация). */
export function useExpensesRows(period: ResolvedPeriod, params: RowsParams) {
  const r = period.current;
  const {
    search = '',
    reason = null,
    cashier = null,
    debtsOnly = false,
    sort = 'date',
    dir = 'desc',
    limit = 50,
    offset = 0,
  } = params;
  return useQuery<ExpensesRowsPage>({
    queryKey: ['expenses-rows', r.from, r.to, search, reason, cashier, debtsOnly, sort, dir, limit, offset],
    queryFn: () =>
      rpc(
        'get_expenses_rows',
        {
          p_from: r.from,
          p_to: r.to,
          p_search: search,
          p_reason: reason,
          p_cashier: cashier,
          p_debts_only: debtsOnly,
          p_sort: sort,
          p_dir: dir,
          p_limit: limit,
          p_offset: offset,
        },
        normalizeRowsPage,
      ),
    placeholderData: (prev) => prev,
  });
}
