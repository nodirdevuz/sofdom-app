import { useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { PeriodSwitcher } from '../components/dashboard/PeriodSwitcher';
import { ExpensesKpis } from '../components/expenses/ExpensesKpis';
import { ExpensesDayChart } from '../components/expenses/ExpensesDayChart';
import { TopRecipients } from '../components/expenses/TopRecipients';
import { ExpensesTable } from '../components/expenses/ExpensesTable';
import { ExcelButton } from '../components/ExcelButton';
import { usePeriod } from '../hooks/usePeriod';
import { useExpensesOverview, useExpenseRecipients } from '../data/useExpenses';
import { useCashiers } from '../data/useCashiers';
import { REASON_KEY } from '../lib/expenses';
import { useT } from '../i18n';
import { periodLabel } from '../lib/period';
import { periodStamp } from '../lib/xlsx';
import { downloadReport } from '../lib/excelReport';

export default function Expenses() {
  const t = useT();
  const { preset, custom, period, setPreset, handleCustomChange } = usePeriod('last30');
  const [debtsOnly, setDebtsOnly] = useState(false);

  const overview = useExpensesOverview(period);
  const recipients = useExpenseRecipients(period, { limit: 12, debtsOnly });
  const { rows: cashierRows } = useCashiers(period);

  // Список кассиров для фильтра таблицы — из экрана «Кассиры» за тот же период.
  const cashiers = cashierRows
    .filter((r) => r.cashier && !r.isService)
    .map((r) => r.cashier as string)
    .sort((a, b) => a.localeCompare(b, 'ru'));

  // Выгрузка расхода по категориям за период (полные агрегаты, уже загружены).
  function handleExport() {
    const o = overview.data;
    if (!o) return;
    void downloadReport({
      filename: `${t('nav.expenses')}_${periodStamp(period.current)}.xlsx`,
      sheetName: t('nav.expenses'),
      title: t('nav.expenses'),
      subtitle: periodLabel(preset, period, t),
      columns: [
        { header: t('expenses.col.category'), type: 'text' },
        { header: t('expenses.col.amount'), type: 'money' },
      ],
      rows: o.byCategory.map((c) => [
        REASON_KEY[c.reason] ? t(REASON_KEY[c.reason]) : c.reason,
        Math.round(c.amount),
      ]),
      total: [t('common.total'), Math.round(o.total)],
    });
  }

  return (
    <>
      <header className="mb-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">
              {t('nav.expenses')}
            </h1>
            <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">
              {t('expenses.subtitle')} · {periodLabel(preset, period, t)}
            </p>
          </div>
          <ExcelButton onClick={handleExport} disabled={!overview.data} />
        </div>
        <PeriodSwitcher
          preset={preset}
          custom={custom}
          onPresetChange={setPreset}
          onCustomChange={handleCustomChange}
        />
      </header>

      {overview.error && (
        <div className="mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {t('common.load_error')} {(overview.error as Error).message}
        </div>
      )}

      {overview.isLoading || !overview.data ? (
        <div className="flex flex-col gap-[15px]">
          <Skeleton className="h-[110px]" />
          <Skeleton className="h-[260px]" />
          <Skeleton className="h-[320px]" />
        </div>
      ) : (
        <div className="flex flex-col gap-[15px]">
          <ExpensesKpis overview={overview.data} />

          <div className="grid grid-cols-1 gap-[15px] lg:grid-cols-[1.7fr_1fr]">
            <ExpensesDayChart byDay={overview.data.byDay} />
            <TopRecipients items={recipients.data ?? []} />
          </div>

          <label className="flex w-fit items-center gap-2 text-[13px] text-[#56616e]">
            <input
              type="checkbox"
              checked={debtsOnly}
              onChange={(e) => setDebtsOnly(e.target.checked)}
            />
            {t('expenses.filter.debts_only')}
          </label>

          <ExpensesTable period={period} cashiers={cashiers} debtsOnly={debtsOnly} />
        </div>
      )}
    </>
  );
}
