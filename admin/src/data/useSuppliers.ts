import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import {
  normalizeDebtHistory,
  normalizeDebtsOnDate,
  normalizePurchases,
  normalizeSummary,
  type DebtMovement,
  type SupplierDebtOnDate,
  type SupplierPurchase,
  type SupplierSummary,
} from '../lib/suppliers';

async function rpc<T>(fn: string, params: Record<string, unknown>, map: (d: unknown) => T): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message);
  return map(data);
}

/** Все поставщики с агрегатами закупок (сумма DESC с сервера, поиск по имени). */
export function useSuppliersSummary(search: string) {
  return useQuery<SupplierSummary[]>({
    queryKey: ['suppliers-summary', search],
    queryFn: () => rpc('get_suppliers_summary', { p_search: search || null }, normalizeSummary),
    placeholderData: (prev) => prev,
  });
}

/** Приходы одного поставщика (свежие сверху). Не грузим, пока поставщик не выбран. */
export function useSupplierPurchases(supplierRef: string | null) {
  return useQuery<SupplierPurchase[]>({
    queryKey: ['supplier-purchases', supplierRef],
    queryFn: () => rpc('get_supplier_purchases', { p_supplier_ref: supplierRef }, normalizePurchases),
    enabled: supplierRef != null,
  });
}

/** Долг каждого поставщика НА дату (история движений в базе). */
export function useDebtsOnDate(date: string) {
  return useQuery<SupplierDebtOnDate[]>({
    queryKey: ['debts-on-date', date],
    queryFn: () => rpc('get_supplier_debt_on_date', { p_date: date }, normalizeDebtsOnDate),
    placeholderData: (prev) => prev,
  });
}

/** Движения долга поставщика за период. Не грузим, пока поставщик не выбран. */
export function useDebtHistory(supplierRef: string | null, from: string, to: string) {
  return useQuery<DebtMovement[]>({
    queryKey: ['debt-history', supplierRef, from, to],
    queryFn: () =>
      rpc(
        'get_supplier_debt_history',
        { p_supplier_ref: supplierRef, p_from: from, p_to: to },
        normalizeDebtHistory,
      ),
    enabled: supplierRef != null,
  });
}
