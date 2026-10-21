// Чистая логика страницы «Расходы»: типы + нормализация ответов RPC (jsonb → TS).
// Без побочных эффектов. Числа приводим Number(...), строки String(...), массивы — guard.
import type { TranslationKey } from '../i18n/dictionaries/ru';

export type ExpenseSort = 'amount' | 'date';
export type SortDir = 'asc' | 'desc';

export interface ExpensesOverview {
  total: number;
  count: number;
  byCategory: { reason: string; amount: number; count: number }[];
  byDay: { d: string; amount: number }[];
  debts: { amount: number; count: number };
}

export interface ExpenseRecipient {
  noteSample: string;
  amount: number;
  count: number;
  isDebt: boolean;
}

export interface ExpenseRow {
  id: number;
  date: string;
  cashier: string | null;
  reason: string;
  amount: number;
  note: string | null;
  isDebt: boolean;
}

export interface ExpensesRowsPage {
  totalCount: number;
  totalAmount: number;
  rows: ExpenseRow[];
}

/** Категория расхода из 1С → ключ перевода. Неизвестную показываем как есть. */
export const REASON_KEY: Record<string, TranslationKey> = {
  Поставщик: 'expenses.cat.supplier',
  Зарплата: 'expenses.cat.salary',
  Возврат: 'expenses.cat.return',
};

/** Фиксированные категории для KPI/фильтра (порядок управляемый). */
export const REASONS: readonly string[] = ['Поставщик', 'Зарплата', 'Возврат'];

const obj = (x: unknown): Record<string, unknown> => (x ?? {}) as Record<string, unknown>;
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

export function normalizeOverview(data: unknown): ExpensesOverview {
  const o = obj(data);
  const d = obj(o.debts);
  return {
    total: Number(o.total ?? 0),
    count: Number(o.count ?? 0),
    byCategory: arr(o.by_category).map((x) => ({
      reason: String(obj(x).reason ?? ''),
      amount: Number(obj(x).amount ?? 0),
      count: Number(obj(x).count ?? 0),
    })),
    byDay: arr(o.by_day).map((x) => ({
      d: String(obj(x).d ?? ''),
      amount: Number(obj(x).amount ?? 0),
    })),
    debts: { amount: Number(d.amount ?? 0), count: Number(d.count ?? 0) },
  };
}

export function normalizeRecipients(data: unknown): ExpenseRecipient[] {
  return arr(data).map((x) => ({
    noteSample: String(obj(x).note_sample ?? ''),
    amount: Number(obj(x).amount ?? 0),
    count: Number(obj(x).count ?? 0),
    isDebt: Boolean(obj(x).is_debt),
  }));
}

export function normalizeRowsPage(data: unknown): ExpensesRowsPage {
  const o = obj(data);
  return {
    totalCount: Number(o.total_count ?? 0),
    totalAmount: Number(o.total_amount ?? 0),
    rows: arr(o.rows).map((x) => {
      const r = obj(x);
      return {
        id: Number(r.id ?? 0),
        date: String(r.date ?? ''),
        cashier: r.cashier == null ? null : String(r.cashier),
        reason: String(r.reason ?? ''),
        amount: Number(r.amount ?? 0),
        note: r.note == null ? null : String(r.note),
        isDebt: Boolean(r.is_debt),
      };
    }),
  };
}

/** Доля (0..100), защита от деления на ноль. */
export function share(amount: number, total: number): number {
  return total > 0 ? (amount / total) * 100 : 0;
}
