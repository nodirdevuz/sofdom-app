import { formatInt, formatMoney } from '../../lib/format';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n/dictionaries/ru';
import type { CashierRow, CashierTotals } from '../../lib/cashiers';

interface CashierTableProps {
  rows: CashierRow[];
  totals: CashierTotals;
}

/** Числовые колонки (Кассир рендерится отдельно — нужен перевод для пустого имени). */
const NUM_COLUMNS: {
  labelKey: TranslationKey;
  cell: (r: CashierRow) => string;
  total: (t: CashierTotals) => string;
}[] = [
  { labelKey: 'cashiers.col.receipts', cell: (r) => formatInt(r.receipts), total: (t) => formatInt(t.receipts) },
  { labelKey: 'cashiers.col.revenue', cell: (r) => formatMoney(r.revenue), total: (t) => formatMoney(t.revenue) },
  { labelKey: 'cashiers.col.cash', cell: (r) => formatMoney(r.cash), total: (t) => formatMoney(t.cash) },
  { labelKey: 'cashiers.col.card', cell: (r) => formatMoney(r.card), total: (t) => formatMoney(t.card) },
  { labelKey: 'cashiers.col.avg_check', cell: (r) => formatMoney(r.avgCheck), total: (t) => formatMoney(t.avgCheck) },
  { labelKey: 'cashiers.col.expenses', cell: (r) => formatMoney(r.expenses), total: (t) => formatMoney(t.expenses) },
  { labelKey: 'cashiers.col.profit', cell: (r) => formatMoney(r.profit), total: (t) => formatMoney(t.profit) },
  { labelKey: 'cashiers.col.returns', cell: (r) => formatMoney(r.returns), total: (t) => formatMoney(t.returns) },
];

const thBase =
  'px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold whitespace-nowrap';
const tdBase = 'px-5 py-[13px] border-b border-[#f3f4f6] text-sm';

export function CashierTable({ rows, totals }: CashierTableProps) {
  const t = useT();

  return (
    <div className="overflow-x-auto rounded-[14px] border border-[#ecedf0] bg-white">
      <table className="w-full border-collapse min-w-[920px]">
        <thead>
          <tr>
            <th className={`${thBase} text-left`}>{t('cashiers.col.cashier')}</th>
            {NUM_COLUMNS.map((col) => (
              <th key={col.labelKey} className={`${thBase} text-right`}>
                {t(col.labelKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cashier ?? '∅'} className="transition-colors hover:bg-[#fafbfc]">
              <td className={`${tdBase} text-left font-semibold text-[#1a1f25]`}>
                {r.cashier ?? t('cashiers.no_cashier')}
              </td>
              {NUM_COLUMNS.map((col) => (
                <td
                  key={col.labelKey}
                  className={`${tdBase} text-right tabular-nums whitespace-nowrap text-[#3a4654] font-medium`}
                >
                  {col.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="bg-[#fafbfc]">
              <td className={`${tdBase} text-left font-bold text-[#1a1f25] border-t border-[#eceef0]`}>
                {t('cashiers.total')}
              </td>
              {NUM_COLUMNS.map((col) => (
                <td
                  key={col.labelKey}
                  className={`${tdBase} text-right tabular-nums whitespace-nowrap font-bold text-[#1a1f25] border-t border-[#eceef0]`}
                >
                  {col.total(totals)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
