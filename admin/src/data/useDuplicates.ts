import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import type { DuplicateDecision, DuplicateMember } from '../types';

export interface DuplicateGroup {
  name_clean: string;
  members: DuplicateMember[];
}

interface UseDuplicatesResult {
  groups: DuplicateGroup[];
  isLoading: boolean;
  error: string | null;
  savingKey: string | null;
  saveDecision: (nameClean: string, decision: DuplicateDecision) => Promise<void>;
}

const PAGE = 1000;

/**
 * Группы дублей из import_duplicates, сгруппированные по name_clean.
 * Группы с уже сохранённым решением (duplicate_decisions) исключаются.
 */
async function fetchDuplicateGroups(): Promise<DuplicateGroup[]> {
  const { data: decisions, error: dError } = await supabase
    .from('duplicate_decisions')
    .select('name_clean');
  if (dError) throw new Error(dError.message);
  const decided = new Set((decisions ?? []).map((d) => (d as { name_clean: string }).name_clean));

  const members: DuplicateMember[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error: qError } = await supabase
      .from('import_duplicates')
      .select('name, name_clean, row_number, stock, purchase_price, sale_price')
      .order('name_clean', { ascending: true })
      .order('row_number', { ascending: true })
      .range(from, from + PAGE - 1);
    if (qError) throw new Error(qError.message);
    if (!data || data.length === 0) break;
    members.push(...(data as DuplicateMember[]));
    if (data.length < PAGE) break;
  }

  const byName = new Map<string, DuplicateMember[]>();
  for (const m of members) {
    if (decided.has(m.name_clean)) continue;
    const arr = byName.get(m.name_clean) ?? [];
    arr.push(m);
    byName.set(m.name_clean, arr);
  }
  return [...byName.entries()].map(([name_clean, groupMembers]) => ({
    name_clean,
    members: groupMembers,
  }));
}

/**
 * Дубли через React Query (queryKey ['duplicates']).
 * Кэш in-memory: при переходах между страницами данные берутся из кэша
 * (staleTime в main.tsx), import_duplicates не перезапрашивается каждый раз.
 */
export function useDuplicates(): UseDuplicatesResult {
  const queryClient = useQueryClient();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['duplicates'],
    queryFn: fetchDuplicateGroups,
  });

  const saveDecision = useCallback(
    async (nameClean: string, decision: DuplicateDecision) => {
      setSavingKey(nameClean);
      const { error: upError } = await supabase
        .from('duplicate_decisions')
        .upsert({ name_clean: nameClean, decision }, { onConflict: 'name_clean' });
      setSavingKey(null);
      if (upError) {
        setSaveError(upError.message);
        return;
      }
      // Помеченная группа уходит из кэша (решение запомнено в БД) — без перезапроса.
      queryClient.setQueryData<DuplicateGroup[]>(['duplicates'], (gs) =>
        (gs ?? []).filter((g) => g.name_clean !== nameClean),
      );
    },
    [queryClient],
  );

  return {
    groups: data ?? [],
    isLoading,
    error: saveError ?? (error ? (error as Error).message : null),
    savingKey,
    saveDecision,
  };
}
