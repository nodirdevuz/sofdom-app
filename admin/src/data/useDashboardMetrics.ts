import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import type { SalesAggregates } from '../lib/dashboard';
import type { DateRange, ResolvedPeriod } from '../lib/period';

interface UseDashboardMetricsResult {
  current: SalesAggregates | null;
  previous: SalesAggregates | null;
  isLoading: boolean;
  error: string | null;
}

/** Приводит jsonb из RPC к SalesAggregates (числа на всякий случай через Number). */
function normalize(raw: unknown): SalesAggregates {
  const o = (raw ?? {}) as Record<string, unknown>;
  const daily = Array.isArray(o.daily) ? o.daily : [];
  return {
    revenue: Number(o.revenue ?? 0),
    cost: Number(o.cost ?? 0),
    lines: Number(o.lines ?? 0),
    receipts: Number(o.receipts ?? 0),
    cash_total: Number(o.cash_total ?? 0),
    card_total: Number(o.card_total ?? 0),
    daily: daily.map((row) => {
      const r = row as Record<string, unknown>;
      return { d: String(r.d), revenue: Number(r.revenue ?? 0) };
    }),
  };
}

/** Один вызов RPC: агрегаты продаж за диапазон [from; to). */
async function fetchAggregates(range: DateRange): Promise<SalesAggregates> {
  const { data, error } = await supabase.rpc('get_sales_dashboard', {
    p_from: range.from,
    p_to: range.to,
  });
  if (error) throw new Error(error.message);
  return normalize(data);
}

/**
 * Метрики дашборда: два запроса к RPC (текущий и предыдущий период).
 * Архитектура A — каждый период кэшируется отдельным queryKey, поэтому при
 * переключении пресетов соседние диапазоны переиспользуются из кэша.
 */
export function useDashboardMetrics(period: ResolvedPeriod): UseDashboardMetricsResult {
  const current = useQuery({
    queryKey: ['dashboard', period.current.from, period.current.to],
    queryFn: () => fetchAggregates(period.current),
  });
  const previous = useQuery({
    queryKey: ['dashboard', period.previous.from, period.previous.to],
    queryFn: () => fetchAggregates(period.previous),
  });

  return {
    current: current.data ?? null,
    previous: previous.data ?? null,
    isLoading: current.isLoading || previous.isLoading,
    error: current.error
      ? (current.error as Error).message
      : previous.error
        ? (previous.error as Error).message
        : null,
  };
}
