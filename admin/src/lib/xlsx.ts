import { addDays, type DateRange } from './period';

/** Описание колонки выгрузки: заголовок + ширина в символах. */
export interface XlsxColumn {
  header: string;
  /** Ширина колонки в символах Excel (по умолчанию 18). */
  width?: number;
}

type Cell = string | number | null | undefined;

/**
 * Клиентская выгрузка в настоящий .xlsx через SheetJS.
 *
 * Используется сборка `xlsx-js-style` — это SheetJS с поддержкой стилей ячеек
 * (community-пакет `xlsx` сам по себе жирный шрифт при записи не сохраняет).
 *
 * Гарантии:
 *  - Заголовки (первая строка) — жирные.
 *  - Числа передаются числами и пишутся как числовые ячейки (t:'n'),
 *    поэтому в Excel работают сортировка и формулы. `null`/`undefined` → пустая ячейка.
 *  - Никаких разделителей-запятых: ровные колонки в любой локали Excel.
 */
export async function downloadXlsx(
  filename: string,
  columns: XlsxColumn[],
  rows: Cell[][],
  sheetName = 'Товары',
): Promise<void> {
  // Динамический импорт: тяжёлая библиотека грузится только при выгрузке,
  // а не в основном бандле приложения.
  const XLSX = await import('xlsx-js-style');

  const header = columns.map((c) => c.header);
  // Пустые значения → '' (пустая ячейка). Числа остаются числами:
  // aoa_to_sheet выводит тип ячейки из типа JS-значения (number → t:'n').
  const body = rows.map((row) => row.map((cell) => (cell === null || cell === undefined ? '' : cell)));

  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);

  // Жирные заголовки.
  for (let c = 0; c < columns.length; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true } };
  }

  // Ширины колонок.
  ws['!cols'] = columns.map((c) => ({ wch: c.width ?? 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/** Сегодняшняя дата в формате DD_MM_YYYY (для имени файла выгрузки). */
export function todayStamp(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}_${mm}_${d.getFullYear()}`;
}

/** '2026-06-27' → '27.06.2026' (для имени файла выгрузки за один день). */
export function dateStamp(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/**
 * Метка периода для имени файла. `to` — исключительная граница [from; to),
 * поэтому последний показанный день = to − 1.
 *  - один день → «27.06.2026»
 *  - диапазон  → «05.06-24.06.2026»
 */
export function periodStamp(range: DateRange): string {
  const lastShown = addDays(range.to, -1);
  if (range.from === lastShown) return dateStamp(range.from);
  const [, fm, fd] = range.from.split('-');
  return `${fd}.${fm}-${dateStamp(lastShown)}`;
}
