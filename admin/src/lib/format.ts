const numberFormat = new Intl.NumberFormat('ru-RU');
const percentFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const decimalFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** «15 990 сум» — сумма с разделителями разрядов (пробел) в узбекских сумах. */
export function formatMoney(value: number): string {
  return `${numberFormat.format(Math.round(value))} сум`;
}

/** «1 248» — целое число с разделителями разрядов. */
export function formatInt(value: number): string {
  return numberFormat.format(value);
}

/** «100 000» — группировка разрядов пробелом для полей ввода сумм (только цифры, целое). */
export function groupDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Безопасно вычислить выражение из чисел, «+» и «−» (мини-калькулятор «Принёс»).
 * «500000 + 100000 + 50000» → 650000. Без eval: токенизация знак+число.
 * Возвращает null, если ни одного числа нет.
 */
export function evalSum(expr: string): number | null {
  const tokens = expr.replace(/[^\d+\-−]/g, '').replace(/−/g, '-').match(/[+-]?\d+/g);
  if (!tokens) return null;
  return Math.round(tokens.reduce((acc, t) => acc + Number(t), 0));
}

/** «21.06.2026» — дата из ISO (YYYY-MM-DD) в привычный вид. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

/** «32,4%» — процент с одним знаком после запятой (маржа, изменение к периоду). */
export function formatPercent(value: number): string {
  return `${percentFormat.format(value)}%`;
}

/** «2,34» — дробное число (например UPT) с разделителями разрядов. */
export function formatDecimal(value: number): string {
  return decimalFormat.format(value);
}

/** «45 млн» / «2,8 млрд» — компактная подпись сумм для осей графика. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${decimalFormat.format(value / 1_000_000_000)} млрд`;
  if (abs >= 1_000_000) return `${Math.round(value / 1_000_000)} млн`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)} тыс`;
  return String(Math.round(value));
}

/**
 * «6 ч 09 мин» / «42 мин» — длительность из МИНУТ.
 * 1С шлёт late_hours/early_leave_hours в минутах, несмотря на имя колонки
 * (проверено по данным: приход − late_hours = начало смены ровно в 07:00/08:00/14:00).
 * Единицы приходят переведёнными (t('staff.hours_short') / t('staff.min_short')).
 */
export function formatMinutesDuration(minutes: number, hourUnit: string, minUnit: string): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h} ${hourUnit} ${m} ${minUnit}` : `${m} ${minUnit}`;
}
