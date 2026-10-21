import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import { normalizeScanNotFound, type ScanNotFoundPage } from '../lib/scanNotFound';

/**
 * Штрихкоды, которые сканировали в приёмке и не нашли.
 *
 * Ручка отдаёт СВЁРНУТО по коду: владельцу важно «что ищут чаще всего», а не
 * лента из тысячи строк. Поэтому страницы здесь нет — есть потолок в ручке.
 */
export function useScanNotFound(search: string) {
  return useQuery<ScanNotFoundPage>({
    queryKey: ['scan-not-found', search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_scan_not_found', {
        p_search: search || null,
        p_limit: 200,
      });
      if (error) throw new Error(error.message);
      return normalizeScanNotFound(data);
    },
    placeholderData: (prev) => prev,
  });
}
