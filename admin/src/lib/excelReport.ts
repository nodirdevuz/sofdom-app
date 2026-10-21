// Красивый экспорт в .xlsx через ExcelJS (стили, заливки, границы, объединение,
// freeze panes — то, что community-SheetJS не умеет). Генерация в браузере по
// клику из уже загруженных данных: моментально и работает офлайн.
//
// Числа остаются числами (можно считать формулами в Excel); « сум» и разделители
// тысяч задаются числовым форматом ячейки, а не текстом.

import type { Borders, Fill, Font } from 'exceljs';

/** Магазин — выводится в подзаголовке каждого отчёта. */
export const STORE_NAME = 'Komfort Market';

export type CellType = 'text' | 'money' | 'int' | 'decimal' | 'percent';
export type AccentColor = 'red' | 'green' | 'orange';
/** Ячейка с собственным типом — переопределяет тип колонки (для разнородных строк). */
export interface TypedCell {
  v: number;
  t: CellType;
}
export type CellValue = string | number | null | undefined | TypedCell;

/** Короткий конструктор ячейки с явным типом: cell(32.4, 'percent'). */
export function cell(v: number, t: CellType): TypedCell {
  return { v, t };
}

function isTyped(x: CellValue): x is TypedCell {
  return typeof x === 'object' && x !== null && 'v' in x && 't' in x;
}

/** Разворачивает ячейку в пару (значение, тип) с учётом per-cell переопределения. */
function resolveCell(raw: CellValue, colType: CellType): { value: string | number | null; type: CellType } {
  if (isTyped(raw)) return { value: raw.v, type: raw.t };
  return { value: raw ?? null, type: colType };
}

export interface ReportColumn {
  header: string;
  type?: CellType; // по умолчанию 'text'
  /** Условный цвет шрифта ячейки по значению (расхождение, статус). */
  color?: (value: CellValue) => AccentColor | undefined;
}

export interface ReportSpec {
  filename: string;
  sheetName: string;
  /** Заголовок отчёта (крупно, жирно): «Сверка наличных по кассирам». */
  title: string;
  /** Период/дата: «за 27.06.2026» (магазин подставляется автоматически). */
  subtitle?: string;
  columns: ReportColumn[];
  rows: CellValue[][];
  /** Необязательная строка «Итого». */
  total?: CellValue[];
}

const ACCENT: Record<AccentColor, string> = { red: 'FFC8332B', green: 'FF1A8A4A', orange: 'FFB9760F' };

const NUMFMT: Record<CellType, string | undefined> = {
  text: undefined,
  money: '#,##0" сум"',
  int: '#,##0',
  decimal: '#,##0.00',
  percent: '0.0"%"',
};

const thin = { style: 'thin' as const, color: { argb: 'FFE2E5E9' } };
const BORDER: Partial<Borders> = { top: thin, left: thin, bottom: thin, right: thin };

const HEADER_FILL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
const ZEBRA_FILL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F8FA' } };
const TOTAL_FILL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF1F4' } };

/** Стандартная окраска расхождения: недостача (−) красным, излишек (+) оранжевым, 0 зелёным. */
export function discrepancyColor(v: CellValue): AccentColor | undefined {
  if (typeof v !== 'number') return undefined;
  return v < 0 ? 'red' : v > 0 ? 'orange' : 'green';
}

/** Оценка ширины колонки в символах под форматированное значение. */
function displayLen(val: CellValue, type: CellType): number {
  if (val == null) return 0;
  if (type === 'text' || typeof val !== 'number') return String(val).length;
  const digits = Math.round(Math.abs(val)).toString().length;
  const groups = Math.max(0, Math.floor((digits - 1) / 3));
  const neg = val < 0 ? 1 : 0;
  const base = digits + groups + neg;
  if (type === 'money') return base + 4; // « сум»
  if (type === 'decimal') return base + 3;
  if (type === 'percent') return 6;
  return base;
}

function alignOf(type: CellType): 'left' | 'right' {
  return type === 'text' ? 'left' : 'right';
}

export async function downloadReport(spec: ReportSpec): Promise<void> {
  // Тяжёлая библиотека грузится только при выгрузке — вне основного бандла.
  const mod = await import('exceljs');
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;

  const wb = new ExcelJS.Workbook();
  const nCols = spec.columns.length;
  const HEADER_ROW = 4; // 1 — заголовок, 2 — магазин·период, 3 — отступ, 4 — шапка
  const ws = wb.addWorksheet(spec.sheetName, {
    views: [{ state: 'frozen', ySplit: HEADER_ROW }],
  });

  // --- Заголовок отчёта (объединён по ширине таблицы) ---
  ws.mergeCells(1, 1, 1, nCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = spec.title;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF1A1F25' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, nCols);
  const subCell = ws.getCell(2, 1);
  subCell.value = [STORE_NAME, spec.subtitle].filter(Boolean).join('  ·  ');
  subCell.font = { size: 11, color: { argb: 'FF8A94A0' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(3).height = 6; // тонкий отступ перед шапкой

  // --- Шапка таблицы ---
  const headerRow = ws.getRow(HEADER_ROW);
  spec.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER;
  });
  headerRow.height = 22;

  // --- Данные (зебра + границы + формат чисел + условный цвет) ---
  spec.rows.forEach((row, r) => {
    const xRow = ws.getRow(HEADER_ROW + 1 + r);
    const zebra = r % 2 === 1;
    spec.columns.forEach((col, c) => {
      const { value, type } = resolveCell(row[c], col.type ?? 'text');
      const xc = xRow.getCell(c + 1);
      xc.value = value;
      const fmt = NUMFMT[type];
      if (fmt && typeof value === 'number') xc.numFmt = fmt;
      xc.alignment = { horizontal: alignOf(type), vertical: 'middle' };
      xc.border = BORDER;
      if (zebra) xc.fill = ZEBRA_FILL;
      const accent = col.color?.(value);
      if (accent) xc.font = { color: { argb: ACCENT[accent] }, bold: true };
    });
  });

  // --- Итого ---
  if (spec.total) {
    const xRow = ws.getRow(HEADER_ROW + 1 + spec.rows.length);
    spec.columns.forEach((col, c) => {
      const { value, type } = resolveCell(spec.total![c], col.type ?? 'text');
      const xc = xRow.getCell(c + 1);
      xc.value = value;
      const fmt = NUMFMT[type];
      if (fmt && typeof value === 'number') xc.numFmt = fmt;
      xc.alignment = { horizontal: alignOf(type), vertical: 'middle' };
      const accent = col.color?.(value);
      const font: Partial<Font> = { bold: true, color: { argb: accent ? ACCENT[accent] : 'FF1A1F25' } };
      xc.font = font;
      xc.fill = TOTAL_FILL;
      xc.border = { ...BORDER, top: { style: 'medium', color: { argb: 'FFB8BFC8' } } };
    });
  }

  // --- Автоширина колонок ---
  spec.columns.forEach((col, i) => {
    const colType = col.type ?? 'text';
    let max = col.header.length;
    for (const row of spec.rows) {
      const { value, type } = resolveCell(row[i], colType);
      max = Math.max(max, displayLen(value, type));
    }
    if (spec.total) {
      const { value, type } = resolveCell(spec.total[i], colType);
      max = Math.max(max, displayLen(value, type));
    }
    ws.getColumn(i + 1).width = Math.min(48, Math.max(10, max + 2));
  });

  // --- Скачивание (Blob → клик по ссылке) ---
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = spec.filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
