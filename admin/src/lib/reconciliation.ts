// Чистая логика сверки наличных по кассирам (без побочных эффектов).

/** Строка сверки за день (из RPC get_cashier_reconciliation). */
export interface ReconciliationRow {
  cashier: string;
  // Наличные
  cashTurnover: number; // нал оборот (по чекам)
  cashExpense: number; // нал расход кассира
  shouldBring: number; // «Должен» (нал) = оборот − расход (автомат)
  factCash: number | null; // «Принёс» нал (сохранённое; null = ещё не вводили)
  discrepancy: number | null; // сохранённое расхождение (нал)
  // Безнал
  cardTurnover: number; // безнал оборот (sum payment_card по чекам)
  cardExpense: number; // безнал расход кассира («Перечисления»)
  shouldCard: number; // «Должен» (безнал) = оборот − расход (автомат)
  factCard: number | null; // «Принёс» безнал (сохранённое; null = ещё не вводили)
  discrepancyCard: number | null; // сохранённое расхождение (безнал)
  note: string | null;
}

export function normalizeReconciliation(data: unknown): ReconciliationRow[] {
  const arr = Array.isArray(data) ? (data as unknown[]) : [];
  return arr.map((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    return {
      cashier: String(o.cashier ?? ''),
      cashTurnover: Number(o.cash_turnover ?? 0),
      cashExpense: Number(o.cash_expense ?? 0),
      shouldBring: Number(o.should_bring ?? 0),
      factCash: o.fact_cash == null ? null : Number(o.fact_cash),
      discrepancy: o.discrepancy == null ? null : Number(o.discrepancy),
      cardTurnover: Number(o.card_turnover ?? 0),
      cardExpense: Number(o.card_expense ?? 0),
      shouldCard: Number(o.should_card ?? 0),
      factCard: o.fact_card == null ? null : Number(o.fact_card),
      discrepancyCard: o.discrepancy_card == null ? null : Number(o.discrepancy_card),
      note: o.note == null ? null : String(o.note),
    };
  });
}

export type ReconStatus = 'match' | 'short' | 'over' | 'empty';

/** Статус по «принёс» относительно «должен»: сошлось / недостача / излишек / не введено. */
export function reconStatus(should: number, fact: number | null): ReconStatus {
  if (fact == null) return 'empty';
  const d = fact - should;
  if (d === 0) return 'match';
  return d < 0 ? 'short' : 'over';
}

/** Сводный статус по двум типам (нал/безнал): учитываем только введённые стороны. */
export function combineReconStatus(cash: ReconStatus, card: ReconStatus): ReconStatus {
  const entered = [cash, card].filter((s) => s !== 'empty');
  if (entered.length === 0) return 'empty';
  if (entered.includes('short')) return 'short';
  if (entered.includes('over')) return 'over';
  return 'match';
}

/** Локальная дата (Asia/Tashkent уже в браузере) в формате YYYY-MM-DD со сдвигом на n дней. */
export function isoDateShift(days: number): string {
  const now = Date.now() + days * 86400000;
  return new Date(now).toISOString().slice(0, 10);
}
