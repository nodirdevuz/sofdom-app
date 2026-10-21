/**
 * Ненайденные штрихкоды: разбор ответа ручки get_scan_not_found.
 *
 * Ответ приходит из базы одним jsonb. Разбор вынесен сюда, а не оставлен в
 * хуке, по той же причине, что и у остальных разделов: страница обязана
 * получить предсказуемые поля, даже если ручка ответит частично.
 */

export interface ScanNotFoundRow {
  /** Сам штрихкод. Ключ строки — он же: ручка уже свернула по нему. */
  barcode: string;
  /** Сколько раз искали. Повтор — полезный сигнал, а не дубль. */
  times: number;
  /** Когда искали в последний раз. */
  lastAt: string;
  /** Кто искал последним. Пусто, если сотрудника уже нет в справочнике. */
  who: string;
}

export interface ScanNotFoundPage {
  rows: ScanNotFoundRow[];
  /** Различных штрихкодов всего (не только на этой выдаче). */
  total: number;
  /** Сканов всего — с повторами. */
  events: number;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeScanNotFound(data: unknown): ScanNotFoundPage {
  const src = (data ?? {}) as Record<string, unknown>;
  const list = Array.isArray(src.rows) ? src.rows : [];

  return {
    rows: list
      .map((r) => {
        const row = (r ?? {}) as Record<string, unknown>;
        return {
          barcode: String(row.barcode ?? ''),
          times: num(row.times),
          lastAt: String(row.last_at ?? ''),
          who: String(row.who ?? ''),
        };
      })
      .filter((r) => r.barcode !== ''),
    total: num(src.total),
    events: num(src.events),
  };
}
