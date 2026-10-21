import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import type { ResolvedPeriod } from '../lib/period';
import { normalizeCashflow, type CashflowByDay } from '../lib/cashflow';

/** Доход/расход/разница по дням за период (RPC get_cashflow_by_day). */
export function useCashflowByDay(period: ResolvedPeriod) {
  const r = period.current;
  return useQuery<CashflowByDay>({
    queryKey: ['cashflow-by-day', r.from, r.to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cashflow_by_day', { p_from: r.from, p_to: r.to });
      if (error) throw new Error(error.message);
      return normalizeCashflow(data);
    },
  });
}
