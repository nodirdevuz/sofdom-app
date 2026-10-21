import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import type { DateRange, ResolvedPeriod } from '../lib/period';
import type {
  DowBucket,
  HourBucket,
  HourCell,
  SalesByHourKpi,
  SalesByHourOverview,
} from '../lib/salesByHour';

interface UseSalesByHourResult {
  overview: SalesByHourOverview | null;
  isLoading: boolean;
  error: string | null;
}

function obj(x: unknown): Record<string, unknown> {
  return (x ?? {}) as Record<string, unknown>;
}

function arr(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

function num(x: unknown): number {
  return Number(x ?? 0);
}

function nullableInt(x: unknown): number | null {
  return x == null ? null : Number(x);
}

function normalizeCell(x: unknown): HourCell {
  const o = obj(x);
  return {
    hour: num(o.hour),
    dow: num(o.dow),
    revenue: num(o.revenue),
    profit: num(o.profit),
    receipts: num(o.receipts),
  };
}

function normalizeHour(x: unknown): HourBucket {
  const o = obj(x);
  return {
    hour: num(o.hour),
    revenue: num(o.revenue),
    profit: num(o.profit),
    receipts: num(o.receipts),
    avgRevenue: num(o.avg_revenue),
  };
}

function normalizeDow(x: unknown): DowBucket {
  const o = obj(x);
  return { dow: num(o.dow), revenue: num(o.revenue), profit: num(o.profit), receipts: num(o.receipts) };
}

function normalizeKpi(x: unknown): SalesByHourKpi {
  const o = obj(x);
  return {
    bestHour: nullableInt(o.best_hour),
    bestHourProfit: num(o.best_hour_profit),
    bestDow: nullableInt(o.best_dow),
    bestDowProfit: num(o.best_dow_profit),
    avgHourRevenue: num(o.avg_hour_revenue),
    totalRevenue: num(o.total_revenue),
  };
}

function normalize(data: unknown): SalesByHourOverview {
  const o = obj(data);
  return {
    cells: arr(o.cells).map(normalizeCell),
    byHour: arr(o.by_hour).map(normalizeHour),
    byDow: arr(o.by_dow).map(normalizeDow),
    kpi: normalizeKpi(o.kpi),
  };
}

async function fetchSalesByHour(range: DateRange): Promise<SalesByHourOverview> {
  const { data, error } = await supabase.rpc('get_sales_by_hour', {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw new Error(error.message);
  return normalize(data);
}

/** Трафик продаж по часам × дням недели за период (Asia/Tashkent). */
export function useSalesByHour(period: ResolvedPeriod): UseSalesByHourResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-by-hour', period.current.from, period.current.to],
    queryFn: () => fetchSalesByHour(period.current),
  });

  return {
    overview: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
