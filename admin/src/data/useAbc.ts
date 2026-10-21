import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import type { DateRange, ResolvedPeriod } from '../lib/period';
import {
  ABC_GROUPS,
  type AbcGroup,
  type AbcGroupSummary,
  type AbcMetric,
  type AbcOverview,
  type AbcRow,
} from '../lib/abc';

interface UseAbcResult {
  overview: AbcOverview | null;
  isLoading: boolean;
  error: string | null;
}

function obj(x: unknown): Record<string, unknown> {
  return (x ?? {}) as Record<string, unknown>;
}

function normalizeMetric(x: unknown): AbcMetric {
  return x === 'revenue' ? 'revenue' : 'profit';
}

function normalizeGroup(x: unknown): AbcGroup {
  return x === 'A' || x === 'B' || x === 'C' ? x : 'C';
}

function normalizeRow(x: unknown): AbcRow {
  const o = obj(x);
  return {
    product_id: String(o.product_id),
    name: o.name == null ? null : String(o.name),
    code: o.code == null ? null : String(o.code),
    qty: Number(o.qty ?? 0),
    revenue: Number(o.revenue ?? 0),
    profit: Number(o.profit ?? 0),
    share: Number(o.share ?? 0),
    cumulative: Number(o.cumulative ?? 0),
    group: normalizeGroup(o.abc_group),
  };
}

function normalizeGroups(x: unknown): Record<AbcGroup, AbcGroupSummary> {
  const o = obj(x);
  const out = {} as Record<AbcGroup, AbcGroupSummary>;
  for (const g of ABC_GROUPS) {
    const gg = obj(o[g]);
    out[g] = { count: Number(gg.count ?? 0), pct: Number(gg.pct ?? 0) };
  }
  return out;
}

function normalize(data: unknown): AbcOverview {
  const o = obj(data);
  const t = obj(o.totals);
  return {
    metric: normalizeMetric(o.metric),
    totals: {
      revenue: Number(t.revenue ?? 0),
      profit: Number(t.profit ?? 0),
      products: Number(t.products ?? 0),
    },
    groups: normalizeGroups(o.groups),
    rows: (Array.isArray(o.rows) ? o.rows : []).map(normalizeRow),
  };
}

async function fetchAbc(range: DateRange, metric: AbcMetric): Promise<AbcOverview> {
  const { data, error } = await supabase.rpc('get_abc_analysis', {
    p_from: range.from,
    p_to: range.to,
    p_metric: metric,
  });
  if (error) throw new Error(error.message);
  return normalize(data);
}

/** Данные экрана «ABC-анализ» за период по выбранной метрике (profit|revenue). */
export function useAbc(period: ResolvedPeriod, metric: AbcMetric): UseAbcResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['abc', metric, period.current.from, period.current.to],
    queryFn: () => fetchAbc(period.current, metric),
  });

  return {
    overview: data ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
