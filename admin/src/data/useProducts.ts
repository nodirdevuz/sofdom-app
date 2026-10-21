import { useEffect, useState } from 'react';
import type { Product } from '../types';
import { mockProducts } from './mock-data';

export interface UseProductsResult {
  products: Product[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Слой доступа к данным о товарах.
 *
 * Сейчас отдаёт моковые данные. Чтобы подключить Supabase, достаточно
 * заменить тело эффекта на реальный запрос — контракт хука не меняется:
 *
 *   const { data, error } = await supabase
 *     .from('products')
 *     .select('code, name, purchase_price, sale_price, stock');
 */
export function useProducts(): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    // TODO(supabase): заменить мок на реальный запрос.
    setProducts(mockProducts);
    setIsLoading(false);
  }, []);

  return { products, isLoading, error };
}
