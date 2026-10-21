import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import type { ProductLatest } from '../types';

interface UseAllProductsResult {
  products: ProductLatest[];
  isLoading: boolean;
  error: string | null;
}

const PAGE = 1000;
const SELECT = 'id, code, name, name_clean, stock, purchase_price, sale_price, snapshot_date';

/** Постранично тянет все строки view product_latest (больше лимита PostgREST). */
async function fetchAllProducts(): Promise<ProductLatest[]> {
  const all: ProductLatest[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('product_latest')
      .select(SELECT)
      .order('name', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as ProductLatest[]));
    if (data.length < PAGE) break;
  }
  return all;
}

/**
 * Все товары из product_latest через React Query.
 * Кэш in-memory: при переходах между страницами данные берутся из кэша
 * (staleTime в main.tsx), база не перезапрашивается каждый раз.
 */
export function useAllProducts(): UseAllProductsResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['all-products'],
    queryFn: fetchAllProducts,
  });

  return {
    products: data ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
