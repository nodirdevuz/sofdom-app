import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import { normalizeReconciliation, type ReconciliationRow } from '../lib/reconciliation';

/** Сверка наличных за день: оборот/расход/должен + сохранённое принёс/расхождение. */
export function useReconciliation(date: string) {
  return useQuery<ReconciliationRow[]>({
    queryKey: ['reconciliation', date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cashier_reconciliation', { p_date: date });
      if (error) throw new Error(error.message);
      return normalizeReconciliation(data);
    },
  });
}

export interface SaveReconInput {
  date: string;
  cashier: string;
  factCash: number;
  factCard: number;
  note?: string | null;
}

/** Сохранить «Принёс» нал+безнал (сервер пересчитывает должен/расхождение для обоих). */
export function useSaveReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveReconInput) => {
      const { error } = await supabase.rpc('save_cashier_reconciliation', {
        p_date: input.date,
        p_cashier: input.cashier,
        p_fact_cash: input.factCash,
        p_fact_card: input.factCard,
        p_note: input.note ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      void qc.invalidateQueries({ queryKey: ['reconciliation', input.date] });
    },
  });
}
