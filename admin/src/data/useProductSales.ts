import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import type { ResolvedPeriod } from '../lib/period';
import type {
  ProductSalesOverview,
  ProductSalesRow,
  ProductSalesTotals,
} from '../lib/productSales';

interface UseProductSalesResult {
  overview: ProductSalesOverview | null;
  isLoading: boolean;
  error: string | null;
}

function obj(x: unknown): Record<string, unknown> {
  return (x ?? {}) as Record<string, unknown>;
}

function num(x: unknown): number {
  return Number(x ?? 0);
}

function nullableNum(x: unknown): number | null {
  return x == null ? null : Number(x);
}

function normalizeRow(x: unknown): ProductSalesRow {
  const o = obj(x);
  return {
    product_id: String(o.product_id),
    name: o.name == null ? null : String(o.name),
    code: o.code == null ? null : String(o.code),
    qty: num(o.qty),
    receipts: num(o.receipts),
    revenue: num(o.revenue),
    profit: num(o.profit),
    avgPrice: num(o.avg_price),
    prevRevenue: nullableNum(o.prev_revenue),
    prevQty: nullableNum(o.prev_qty),
  };
}

function normalizeTotals(x: unknown): ProductSalesTotals {
  const o = obj(x);
  return {
    products: num(o.products),
    qty: num(o.qty),
    revenue: num(o.revenue),
    profit: num(o.profit),
    receipts: num(o.receipts),
  };
}

function normalize(data: unknown): ProductSalesOverview {
  const o = obj(data);
  return {
    hasPrev: Boolean(o.has_prev),
    totals: normalizeTotals(o.totals),
    rows: (Array.isArray(o.rows) ? o.rows : []).map(normalizeRow),
  };
}

async function fetchProductSales(
  period: ResolvedPeriod,
  compare: boolean,
): Promise<ProductSalesOverview> {
  const { data, error } = await supabase.rpc('get_product_sales', {
    p_from: period.current.from,
    p_to: period.current.to,
    p_prev_from: compare ? period.previous.from : null,
    p_prev_to: compare ? period.previous.to : null,
  });
  if (error) throw new Error(error.message);
  return normalize(data);
}

/** Продажи товаров за период; compare — добавить сравнение с прошлым периодом. */
export function useProductSales(period: ResolvedPeriod, compare: boolean): UseProductSalesResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['product-sales', period.current.from, period.current.to, compare],
    queryFn: () => fetchProductSales(period, compare),
  });

  return {
    overview: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
