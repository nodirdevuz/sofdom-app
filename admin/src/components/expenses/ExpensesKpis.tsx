import { KPICard } from '../KPICard';
import { formatMoney, formatPercent } from '../../lib/format';
import { useT } from '../../i18n';
import { REASON_KEY, REASONS, share, type ExpensesOverview } from '../../lib/expenses';
import type { Kpi } from '../../types';

/** KPI-карточки: общий расход + по категориям (с долями) + долги (qarz). */
export function ExpensesKpis({ overview }: { overview: ExpensesOverview }) {
  const t = useT();
  const { total, byCategory, debts } = overview;
  const amountByReason = new Map(byCategory.map((c) => [c.reason, c.amount]));

  const kpis: Kpi[] = [
    { value: formatMoney(total), label: t('expenses.kpi.total') },
    ...REASONS.map((reason): Kpi => {
      const amount = amountByReason.get(reason) ?? 0;
      const key = REASON_KEY[reason];
      return {
        value: formatMoney(amount),
        label: `${key ? t(key) : reason} · ${formatPercent(share(amount, total))}`,
      };
    }),
    {
      value: formatMoney(debts.amount),
      label: `${t('expenses.kpi.debts')} · ${formatPercent(share(debts.amount, total))}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((kpi, i) => (
        <KPICard key={i} kpi={kpi} />
      ))}
    </div>
  );
}
