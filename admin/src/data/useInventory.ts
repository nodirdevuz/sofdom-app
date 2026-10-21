import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import type { DateRange, ResolvedPeriod } from '../lib/period';
import type { DeadProduct, InventoryOverview, TopProduct } from '../lib/inventory';

interface UseInventoryResult {
  overview: InventoryOverview | null;
  isLoading: boolean;
  error: string | null;
}

function obj(x: unknown): Record<string, unknown> {
  return (x ?? {}) as Record<string, unknown>;
}

function normalizeTop(x: unknown): TopProduct {
  const o = obj(x);
  return {
    product_id: String(o.product_id),
    name: o.name == null ? null : String(o.name),
    code: o.code == null ? null : String(o.code),
    qty: Number(o.qty ?? 0),
    revenue: Number(o.revenue ?? 0),
    profit: Number(o.profit ?? 0),
  };
}

function normalizeDead(x: unknown): DeadProduct {
  const o = obj(x);
  return {
    product_id: String(o.product_id),
    name: o.name == null ? null : String(o.name),
    code: o.code == null ? null : String(o.code),
    stock: Number(o.stock ?? 0),
    days_no_sale: o.days_no_sale == null ? null : Number(o.days_no_sale),
    frozen: Number(o.frozen ?? 0),
  };
}

function normalize(data: unknown): InventoryOverview {
  const o = obj(data);
  const k = obj(o.kpi);
  return {
    top: (Array.isArray(o.top) ? o.top : []).map(normalizeTop),
    dead: (Array.isArray(o.dead) ? o.dead : []).map(normalizeDead),
    kpi: {
      inStockCount: Number(k.in_stock_count ?? 0),
      deadCount: Number(k.dead_count ?? 0),
      frozenCapital: Number(k.frozen_capital ?? 0),
    },
  };
}

async function fetchInventory(range: DateRange): Promise<InventoryOverview> {
  const { data, error } = await supabase.rpc('get_inventory_overview', {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw new Error(error.message);
  return normalize(data);
}

/** Данные экрана «Деньги на полках» за текущий период (топ + мёртвый сток + KPI). */
export function useInventory(period: ResolvedPeriod): UseInventoryResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory', period.current.from, period.current.to],
    queryFn: () => fetchInventory(period.current),
  });

  return {
    overview: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
