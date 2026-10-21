// Сегменты по размеру чека: типы, приведение ответа и работа с границами.
//
// 🔴 ЭТО СЕГМЕНТЫ ЧЕКОВ, А НЕ ЛЮДЕЙ, И ЭТО НЕ МЕЛОЧЬ.
// Замер боевой базы за 01.08–05.09.2026: чеков 27 918, из них с картой лояльности — 740, то есть
// 2,7 %; разных карт 168. Привязка чека к человеку в базе ЕСТЬ (код карты пишет касса в строку
// продажи), но она стоит у одного чека из тридцати семи. Поэтому экран делит только ЧЕКИ и не
// показывает людей вовсе. Число разных карт остаётся в MCP с пояснением владельцу.
//
// 🔴 СУММЫ И СРЕДНИЕ В ЭТОМ ФАЙЛЕ НЕ ПЕРЕСЧИТЫВАЮТСЯ. Их считает функция базы
// `get_customer_segments`, её же зовёт MCP. Посчитай мы что-то здесь заново — получили бы вторую
// правду о тех же числах. Здесь из готового числа чеков распределяется только доля до сотых
// процента тем же способом, что в MCP, чтобы показанный итог был ровно 100,00%.

/** Одна строка таблицы: границы сегмента и его числа. */
export interface SegmentRow {
  /** Нижняя граница включительно. */
  min_amount: number;
  /** Верхняя граница НЕ включительно; null — верхний сегмент, он открыт вверх. */
  max_amount: number | null;
  receipts: number;
  /**
   * Сколько РАЗНЫХ карт лояльности встретилось в сегменте. Не число покупателей: чеков без карты
   * подавляющее большинство, и они сюда не попадают вовсе.
   */
  customers: number;
  revenue: number;
  /** Доля чеков, проценты 0..100. */
  receipts_share: number;
  /** Доля в обороте, проценты 0..100. Считает база. */
  revenue_share: number;
  avg_check: number;
  /** Среднее число позиций в чеке. */
  avg_items: number;
}

export interface SegmentsOverview {
  segments: SegmentRow[];
  totals: {
    receipts: number;
    revenue: number;
    /** Сколько чеков вообще привязано к карте — числитель той самой оговорки. */
    receipts_with_card: number;
    /** Сколько разных карт за период. */
    customers: number;
  };
}

/**
 * Границы по умолчанию. Средний чек по магазину за 01.08–05.09.2026 — около 46 000 сум
 * (1 290 421 074 / 27 918), поэтому пороги расставлены вокруг него.
 *
 * ⚠️ Это только НАЧАЛЬНОЕ значение. Владелец меняет границы прямо на экране — это его прямое
 * требование, поэтому зашивать их в расчёт нельзя ни здесь, ни в функции базы.
 */
export const DEFAULT_BOUNDS: number[] = [10_000, 50_000, 100_000, 200_000];

/**
 * Где храним границы владельца между заходами.
 *
 * ⚠️ Само чтение и запись живут в hooks/useSegmentBounds.ts, а не здесь: этот файл — чистая
 * логика, его гоняет скрипт проверки под Node, где никакого localStorage нет вовсе.
 */
export const BOUNDS_STORAGE_KEY = 'komfort.segments.bounds';

/**
 * Границы годны, если это строго возрастающие целые числа больше нуля.
 *
 * Нестрогое возрастание пропустить нельзя: две одинаковые границы дадут ПУСТОЙ сегмент, а пустая
 * строка в отчёте читается как «в этом диапазоне никто не покупает» — то есть неверный ответ, а не
 * пустой экран. Дробные тоже не годятся: границы — это суммы в сумах, копеек у нас нет.
 */
export function boundsAreValid(bounds: number[]): boolean {
  if (bounds.length === 0) return false;
  return bounds.every(
    (b, i) => Number.isInteger(b) && b > 0 && (i === 0 || b > (bounds[i - 1] as number)),
  );
}

function obj(x: unknown): Record<string, unknown> {
  return (x ?? {}) as Record<string, unknown>;
}
function arr(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}
function num(x: unknown): number {
  return Number(x ?? 0);
}

/** Доли с двумя знаками, распределённые так, чтобы показанная сумма была 100,00%. */
export function allocatePercentShares(values: number[], total: number): number[] {
  if (total <= 0 || values.length === 0) return values.map(() => 0);

  const units = values.map((value, index) => {
    const exact = (Math.max(0, value) * 10_000) / total;
    const floor = Math.floor(exact);
    return { index, floor, remainder: exact - floor };
  });
  const left = 10_000 - units.reduce((sum, item) => sum + item.floor, 0);
  const ranked = [...units].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < left; i += 1) ranked[i % ranked.length]!.floor += 1;
  return units.map((item) => item.floor / 100);
}

/** Приводит jsonb из RPC к SegmentsOverview и добавляет долю чеков. */
export function normalizeSegments(data: unknown): SegmentsOverview {
  const o = obj(data);
  const t = obj(o.totals);
  const totals = {
    receipts: num(t.receipts),
    revenue: num(t.revenue),
    receipts_with_card: num(t.receipts_with_card),
    customers: num(t.customers),
  };
  const rows = arr(o.segments).map((x) => {
    const r = obj(x);
    return {
      min_amount: num(r.min_amount),
      max_amount: r.max_amount == null ? null : num(r.max_amount),
      receipts: num(r.receipts),
      customers: num(r.customers),
      revenue: num(r.revenue),
      receipts_share: 0,
      revenue_share: num(r.revenue_share),
      avg_check: num(r.avg_check),
      avg_items: num(r.avg_items),
    };
  });
  const receiptShares = allocatePercentShares(rows.map((row) => row.receipts), totals.receipts);
  return {
    segments: rows.map((row, index) => ({ ...row, receipts_share: receiptShares[index] ?? 0 })),
    totals,
  };
}

/**
 * Подпись сегмента: «до 20 000», «20 000 – 50 000», «от 200 000».
 *
 * 🔴 ШАБЛОНЫ, А НЕ СКЛЕЙКА СЛОВА С ЧИСЛОМ. По-русски предлог стоит ПЕРЕД числом («до 20 000»), а
 * по-узбекски послелог — ПОСЛЕ («20 000 гача»). Склей мы «слово + число» в коде, узбекская
 * версия читалась бы как «гача 20 000», и заметил бы это только тот, кто читает по-узбекски.
 * Поэтому порядок слов задаёт сам перевод, а код только подставляет числа.
 *
 * Формат денег приходит снаружи, чтобы этот файл не тянул за собой i18n и форматирование.
 */
export function segmentLabel(
  row: SegmentRow,
  money: (v: number) => string,
  templates: { upTo: string; from: string; range: string },
): string {
  if (row.min_amount <= 0 && row.max_amount != null) {
    return templates.upTo.replace('{v}', money(row.max_amount));
  }
  if (row.max_amount == null) return templates.from.replace('{v}', money(row.min_amount));
  return templates.range
    .replace('{a}', money(row.min_amount))
    .replace('{b}', money(row.max_amount));
}
