import { useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { PeriodSwitcher } from '../components/dashboard/PeriodSwitcher';
import { CashierTable } from '../components/cashiers/CashierTable';
import { ExpensesBlock } from '../components/cashiers/ExpensesBlock';
import { ReconciliationTable } from '../components/cashiers/ReconciliationTable';
import { ExcelButton } from '../components/ExcelButton';
import { useCashiers } from '../data/useCashiers';
import { useReconciliation } from '../data/useReconciliation';
import { usePeriod } from '../hooks/usePeriod';
import { computeTotals } from '../lib/cashiers';
import { isoDateShift, reconStatus, combineReconStatus } from '../lib/reconciliation';
import { useT } from '../i18n';
import { periodLabel } from '../lib/period';
import { dateStamp, periodStamp } from '../lib/xlsx';
import { downloadReport, discrepancyColor, type AccentColor, type CellValue } from '../lib/excelReport';

const errBox = 'mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]';
const emptyBox = 'rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]';

/** Экран «Кассиры». Подстраницы (из сайдбара): Продажи (view='sales') и Сверка наличных (view='recon'). */
export default function Cashiers({ view }: { view: 'sales' | 'recon' }) {
  const t = useT();
  const { preset, custom, period, setPreset, handleCustomChange } = usePeriod('last30');
  const { rows, expenses, isLoading, error } = useCashiers(period);

  // Служебный «Приход» — не кассир: убираем из таблицы и итогов, показываем сноской.
  const cashierRows = rows.filter((r) => !r.isService);
  const serviceReceipts = rows.filter((r) => r.isService).reduce((acc, r) => acc + r.receipts, 0);
  const totals = computeTotals(cashierRows);

  // Сверка — свой выбор дня, по умолчанию Вчера.
  const [reconDate, setReconDate] = useState(() => isoDateShift(-1));
  const recon = useReconciliation(reconDate);

  // Выгрузка таблицы кассиров (с итогом), числами для Excel.
  function exportSales() {
    void downloadReport({
      filename: `${t('nav.cashiers')}_${periodStamp(period.current)}.xlsx`,
      sheetName: t('nav.cashiers'),
      title: t('nav.cashiers'),
      subtitle: periodLabel(preset, period, t),
      columns: [
        { header: t('cashiers.col.cashier'), type: 'text' },
        { header: t('cashiers.col.receipts'), type: 'int' },
        { header: t('cashiers.col.revenue'), type: 'money' },
        { header: t('cashiers.col.cash'), type: 'money' },
        { header: t('cashiers.col.card'), type: 'money' },
        { header: t('cashiers.col.avg_check'), type: 'money' },
        { header: t('cashiers.col.expenses'), type: 'money' },
        { header: t('cashiers.col.profit'), type: 'money' },
        { header: t('cashiers.col.returns'), type: 'money' },
      ],
      rows: cashierRows.map((r) => [
        r.cashier ?? t('cashiers.no_cashier'),
        r.receipts,
        Math.round(r.revenue),
        Math.round(r.cash),
        Math.round(r.card),
        Math.round(r.avgCheck),
        Math.round(r.expenses),
        Math.round(r.profit),
        Math.round(r.returns),
      ]),
      total: [
        t('cashiers.total'),
        totals.receipts,
        Math.round(totals.revenue),
        Math.round(totals.cash),
        Math.round(totals.card),
        Math.round(totals.avgCheck),
        Math.round(totals.expenses),
        Math.round(totals.profit),
        Math.round(totals.returns),
      ],
    });
  }

  // Выгрузка сверки за день: нал + безнал + сводный статус (с цветными акцентами).
  function exportRecon() {
    const data = recon.data ?? [];
    const statusColor = (v: CellValue): AccentColor | undefined => {
      if (v === t('recon.status.short')) return 'red';
      if (v === t('recon.status.over')) return 'orange';
      if (v === t('recon.status.match')) return 'green';
      return undefined;
    };
    const cashCols = (group: 'cash' | 'card') => [
      { header: `${t(`recon.group.${group}`)}: ${t('recon.col.turnover')}`, type: 'money' as const },
      { header: `${t(`recon.group.${group}`)}: ${t('recon.col.expense')}`, type: 'money' as const },
      { header: `${t(`recon.group.${group}`)}: ${t('recon.col.should')}`, type: 'money' as const },
      { header: `${t(`recon.group.${group}`)}: ${t('recon.col.fact')}`, type: 'money' as const },
      {
        header: `${t(`recon.group.${group}`)}: ${t('recon.col.discrepancy')}`,
        type: 'money' as const,
        color: discrepancyColor,
      },
    ];
    void downloadReport({
      filename: `${t('nav.cashiers')}_${t('recon.tab')}_${dateStamp(reconDate)}.xlsx`,
      sheetName: t('recon.tab'),
      title: t('recon.tab'),
      subtitle: dateStamp(reconDate),
      columns: [
        { header: t('recon.col.cashier'), type: 'text' },
        ...cashCols('cash'),
        ...cashCols('card'),
        { header: t('recon.col.status'), type: 'text', color: statusColor },
      ],
      rows: data.map((r) => {
        const status = combineReconStatus(
          reconStatus(r.shouldBring, r.factCash),
          reconStatus(r.shouldCard, r.factCard),
        );
        return [
          r.cashier,
          Math.round(r.cashTurnover),
          Math.round(r.cashExpense),
          Math.round(r.shouldBring),
          r.factCash,
          r.discrepancy,
          Math.round(r.cardTurnover),
          Math.round(r.cardExpense),
          Math.round(r.shouldCard),
          r.factCard,
          r.discrepancyCard,
          t(`recon.status.${status}`),
        ];
      }),
    });
  }

  return (
    <>
      <header className="mb-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">
              {t('nav.cashiers')} · {view === 'sales' ? t('cashiers.tab_sales') : t('recon.tab')}
            </h1>
            <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">
              {view === 'sales' ? `${t('cashiers.subtitle')} · ${periodLabel(preset, period, t)}` : t('recon.subtitle')}
            </p>
          </div>
          {view === 'sales' ? (
            <ExcelButton onClick={exportSales} disabled={cashierRows.length === 0} />
          ) : (
            <ExcelButton onClick={exportRecon} disabled={!recon.data || recon.data.length === 0} />
          )}
        </div>

        {view === 'sales' ? (
          <PeriodSwitcher preset={preset} custom={custom} onPresetChange={setPreset} onCustomChange={handleCustomChange} />
        ) : (
          <div className="flex items-center gap-3">
            <label className="text-sm text-[#8a94a0]" htmlFor="recon-day">
              {t('recon.day')}
            </label>
            <input
              id="recon-day"
              type="date"
              value={reconDate}
              onChange={(e) => setReconDate(e.target.value)}
              className="rounded-[8px] border border-[#dfe2e7] px-3 py-1.5 text-sm outline-none focus:border-[#1a8a4a]"
            />
          </div>
        )}
      </header>

      {view === 'sales' ? (
        <>
          {error && (
            <div className={errBox}>
              {t('common.load_error')} {error}
            </div>
          )}
          {isLoading ? (
            <div className="flex flex-col gap-[15px]">
              <Skeleton className="h-[240px]" />
              <Skeleton className="h-[180px]" />
            </div>
          ) : cashierRows.length === 0 ? (
            <div className={emptyBox}>{t('cashiers.empty')}</div>
          ) : (
            <div className="flex flex-col gap-[15px]">
              <CashierTable rows={cashierRows} totals={totals} />
              {serviceReceipts > 0 && (
                <p className="m-0 text-[12.5px] text-[#9aa4b0]">{t('cashiers.service_excluded', { count: serviceReceipts })}</p>
              )}
              {expenses && <ExpensesBlock expenses={expenses} />}
            </div>
          )}
        </>
      ) : (
        <>
          {recon.error && (
            <div className={errBox}>
              {t('common.load_error')} {(recon.error as Error).message}
            </div>
          )}
          {recon.isLoading ? (
            <Skeleton className="h-[240px]" />
          ) : !recon.data || recon.data.length === 0 ? (
            <div className={emptyBox}>{t('recon.empty')}</div>
          ) : (
            <div className="flex flex-col gap-[12px]">
              <ReconciliationTable date={reconDate} rows={recon.data} />
              <p className="m-0 text-[12.5px] text-[#9aa4b0]">{t('recon.note_cash_only')}</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
