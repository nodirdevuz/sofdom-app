import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Не заданы VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (см. .env.example).');
}

/**
 * Предел ожидания на КАЖДЫЙ запрос к базе.
 *
 * 15.09.2026: экран «Сотрудники» висел на «Yuklanmoqda…» бесконечно — ни списка,
 * ни ошибки. Сервер при этом был здоров (`get_employees` отвечал 200 за 0,4 с и
 * отдавал 31 строку). Висел клиент, и висел молча: у запроса не было предела
 * ожидания, поэтому экран ждал ответа, которого никогда не будет, а человек
 * видел вечную загрузку и не мог даже понять, что сломалось.
 *
 * Десяти секунд хватает с запасом: по замеру 15.09 все ручки админки отвечают
 * быстрее 0,5 с. Срок вышел — запрос обрывается, и экран получает ОШИБКУ,
 * которую покажет человеку вместе с кнопкой «Повторить».
 */
const REQUEST_TIMEOUT_MS = 10000;

/** fetch с обрывом по времени: одно место на все запросы всех экранов. */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  /* Свой signal вызывающего не теряем: react-query отменяет запросы при уходе
     с экрана, и без этого отмена перестала бы работать. */
  if (init?.signal) {
    if (init.signal.aborted) ctrl.abort();
    else init.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: ctrl.signal })
    .catch((e: unknown) => {
      // Отличаем «мы сами оборвали по сроку» от обычной сетевой ошибки:
      // человеку это разные сообщения — «сервер не ответил» и «нет связи».
      if (e instanceof DOMException && e.name === 'AbortError' && !init?.signal?.aborted) {
        throw new Error(`Сервер не ответил за ${REQUEST_TIMEOUT_MS / 1000} с`);
      }
      throw e;
    })
    .finally(() => clearTimeout(timer));
}

/** Браузерный клиент Supabase (anon-ключ, доступ ограничен RLS). */
export const supabase = createClient(url, anonKey, {
  global: { fetch: fetchWithTimeout },
});
