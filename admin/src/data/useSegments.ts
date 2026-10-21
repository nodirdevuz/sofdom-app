import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import { normalizeSegments, type SegmentsOverview } from '../lib/segments';
import type { DateRange, ResolvedPeriod } from '../lib/period';

interface UseSegmentsResult {
  overview: SegmentsOverview | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Один вызов RPC: сегменты чеков за диапазон [from; to) с границами владельца.
 *
 * 🔴 ГРАНИЦЫ ИДУТ ПАРАМЕТРОМ, А НЕ ЗАШИТЫ. Владелец меняет их прямо на экране — это его прямое
 * требование. Поэтому и функция базы принимает массив, и запрос кэшируется вместе с ним: сменил
 * границы — это другой запрос, а не тот же с подставленным ответом.
 */
async function fetchSegments(range: DateRange, bounds: number[]): Promise<SegmentsOverview> {
  const { data, error } = await supabase.rpc('get_customer_segments', {
    p_from: range.from,
    p_to: range.to,
    p_bounds: bounds,
  });
  if (error) throw new Error(error.message);
  return normalizeSegments(data);
}

/**
 * Сегменты по размеру чека за текущий период.
 *
 * `enabled` снаружи: пока владелец правит границы и они не годятся (не возрастают, есть ноль),
 * запрос слать нельзя — иначе база вернёт пустые или перекрывающиеся сегменты, а выглядеть это
 * будет как «в этом диапазоне никто не покупает».
 */
export function useSegments(
  period: ResolvedPeriod,
  bounds: number[],
  enabled: boolean,
): UseSegmentsResult {
  const { data, isLoading, error } = useQuery({
    // Границы — часть ключа: иначе при их смене экран показал бы прошлый ответ.
    queryKey: ['customer-segments', period.current.from, period.current.to, bounds.join(',')],
    queryFn: () => fetchSegments(period.current, bounds),
    enabled,
  });

  return {
    overview: data ?? null,
    isLoading: enabled && isLoading,
    error: error ? (error as Error).message : null,
  };
}
