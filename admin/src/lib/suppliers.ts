// Чистая логика раздела «Поставщики»: типы + нормализация ответов RPC (jsonb → TS).
// Без побочных эффектов (по образцу lib/expenses.ts).
import type { SortDir } from './expenses';

export interface SupplierSummary {
  supplierRef: string;
  supplierName: string;
  totalAmount: number;
  deliveriesCount: number;
  lastDate: string;
}

export interface SupplierPurchase {
  id: number;
  date: string;
  productName: string;
  qty: number;
  purchasePrice: number;
  amount: number;
  docNumber: string;
}

export interface SupplierDebtOnDate {
  supplierRef: string;
  supplierName: string;
  receivedTotal: number;
  paidTotal: number;
  debt: number;
}

export interface DebtMovement {
  id: number;
  date: string;
  received: number;
  paid: number;
  /** Долг нарастающим итогом после этого движения. */
  debtAfter: number;
}

export type SupplierSort = 'amount' | 'name' | 'date';

const obj = (x: unknown): Record<string, unknown> => (x ?? {}) as Record<string, unknown>;
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

export function normalizeSummary(data: unknown): SupplierSummary[] {
  return arr(data).map((x) => {
    const r = obj(x);
    return {
      supplierRef: String(r.supplier_ref ?? ''),
      supplierName: String(r.supplier_name ?? ''),
      totalAmount: Number(r.total_amount ?? 0),
      deliveriesCount: Number(r.deliveries_count ?? 0),
      lastDate: String(r.last_date ?? ''),
    };
  });
}

export function normalizePurchases(data: unknown): SupplierPurchase[] {
  return arr(data).map((x, i) => {
    const r = obj(x);
    return {
      id: i,
      date: String(r.date ?? ''),
      productName: String(r.product_name ?? ''),
      qty: Number(r.qty ?? 0),
      purchasePrice: Number(r.purchase_price ?? 0),
      amount: Number(r.amount ?? 0),
      docNumber: String(r.doc_number ?? ''),
    };
  });
}

export function normalizeDebtsOnDate(data: unknown): SupplierDebtOnDate[] {
  return arr(data).map((x) => {
    const r = obj(x);
    return {
      supplierRef: String(r.supplier_ref ?? ''),
      supplierName: String(r.supplier_name ?? ''),
      receivedTotal: Number(r.received_total ?? 0),
      paidTotal: Number(r.paid_total ?? 0),
      debt: Number(r.debt ?? 0),
    };
  });
}

export function normalizeDebtHistory(data: unknown): DebtMovement[] {
  return arr(data).map((x, i) => {
    const r = obj(x);
    return {
      id: i,
      date: String(r.date ?? ''),
      received: Number(r.received ?? 0),
      paid: Number(r.paid ?? 0),
      debtAfter: Number(r.debt_after ?? 0),
    };
  });
}

/** Клиентская сортировка списка поставщиков (строк мало, ~230). */
export function sortSuppliers(
  rows: SupplierSummary[],
  sort: SupplierSort,
  dir: SortDir,
): SupplierSummary[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sort === 'name') return sign * a.supplierName.localeCompare(b.supplierName, 'ru');
    if (sort === 'date') return sign * a.lastDate.localeCompare(b.lastDate);
    return sign * (a.totalAmount - b.totalAmount);
  });
}
