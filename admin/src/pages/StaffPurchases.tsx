import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { DataTable, type Column } from '../components/DataTable';
import { KPICard } from '../components/KPICard';
import { PeriodSwitcher } from '../components/dashboard/PeriodSwitcher';
import { usePeriod } from '../hooks/usePeriod';
import { useT } from '../i18n';
import { periodLabel } from '../lib/period';
import { formatDate, formatInt, formatMoney } from '../lib/format';
import { useEmployees, useStaffPurchases } from '../data/useStaff';
import type { StaffPurchaseRow, StaffPurchasesPage } from '../lib/staff';

const PAGE_SIZE = 50;

const controlClass =
  'px-[11px] py-[7px] rounded-[9px] border border-[#e6e8eb] text-[13px] text-[#1a1f25] bg-white focus:outline-none focus:border-[#1f2937]';

/** «Покупки»: товар в счёт зарплаты — период + фильтр по сотруднику + итоги. */
export default function StaffPurchases() {
  const t = useT();
  const { preset, custom, period, setPreset, handleCustomChange } = usePeriod('last30');
  const [employeeRef, setEmployeeRef] = useState('');
  const [page, setPage] = useState(0);

  // Смена периода/сотрудника → на первую страницу.
  useEffect(() => {
    setPage(0);
  }, [period.current.from, period.current.to, employeeRef]);

  // Все сотрудники (включая уволенных) для фильтра.
  const employees = useEmployees('', false);
  const query = useStaffPurchases({
    from: period.current.from,
    to: period.current.to,
    employeeRef: employeeRef || null,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const data: StaffPurchasesPage | undefined = query.data;
  const totalCount = data?.totalCount ?? 0;
  const lastPage = Math.max(0, Math.ceil(totalCount / PAGE_SIZE) - 1);

  const summaryColumns: Column<StaffPurchasesPage['byEmployee'][number]>[] = useMemo(
    () => [
      {
        key: 'name',
        label: t('staff.col.employee'),
        cellClassName: 'font-medium',
        render: (r) => r.employeeName,
      },
      { key: 'count', label: t('staff.col.count'), align: 'right', render: (r) => formatInt(r.count) },
      {
        key: 'amount',
        label: t('suppliers.col.amount'),
        align: 'right',
        cellClassName: 'font-semibold',
        render: (r) => formatMoney(r.amount),
      },
    ],
    [t],
  );

  const rowColumns: Column<StaffPurchaseRow>[] = useMemo(
    () => [
      {
        key: 'name',
        label: t('staff.col.employee'),
        cellClassName: 'font-medium',
        render: (r) => r.employeeName,
      },
      { key: 'date', label: t('suppliers.col.date'), render: (r) => formatDate(r.date) },
      {
        key: 'product',
        label: t('suppliers.col.product'),
        render: (r) => <span className="whitespace-normal">{r.productName}</span>,
      },
      { key: 'qty', label: t('suppliers.col.qty'), align: 'right', render: (r) => formatInt(r.qty) },
      {
        key: 'amount',
        label: t('suppliers.col.amount'),
        align: 'right',
        cellClassName: 'font-semibold',
        render: (r) => formatMoney(r.amount),
      },
    ],
    [t],
  );

  return (
    <>
      <header className="mb-5 flex flex-col gap-4">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">
            {t('nav.staff_purchases')}
          </h1>
          <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">
            {t('staff.pur.subtitle')} · {periodLabel(preset, period, t)}
          </p>
        </div>
        <PeriodSwitcher
          preset={preset}
          custom={custom}
          onPresetChange={setPreset}
          onCustomChange={handleCustomChange}
        />
      </header>

      {query.error && (
        <div className="mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {t('common.load_error')} {(query.error as Error).message}
        </div>
      )}

      {query.isLoading || !data ? (
        <div className="flex flex-col gap-[15px]">
          <Skeleton className="h-[110px]" />
          <Skeleton className="h-[420px]" />
        </div>
      ) : (
        <div className="flex flex-col gap-[15px]">
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-5">
            <KPICard kpi={{ value: formatMoney(data.totalAmount), label: t('staff.pur.kpi.total') }} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className={controlClass}
              value={employeeRef}
              onChange={(e) => setEmployeeRef(e.target.value)}
            >
              <option value="">{t('staff.filter.all_employees')}</option>
              {(employees.data ?? []).map((e) => (
                <option key={e.refKey} value={e.refKey}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          {data.rows.length === 0 ? (
            <div className="rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
              {t('common.not_found')}
            </div>
          ) : (
            <>
              {/* Итог по сотрудникам показываем, когда фильтр не сузил до одного. */}
              {!employeeRef && (
                <DataTable
                  title={t('staff.pur.summary.title')}
                  count={data.byEmployee.length}
                  columns={summaryColumns}
                  rows={data.byEmployee}
                  rowKey={(r) => r.employeeRef}
                  mobileCards
                />
              )}

              <DataTable
                title={t('staff.pur.table.title')}
                count={totalCount}
                columns={rowColumns}
                rows={data.rows}
                rowKey={(r) => String(r.id)}
                mobileCards
              />
              <div className="flex flex-wrap items-center justify-end gap-2 text-[13px] text-[#8a94a0]">
                <button
                  type="button"
                  disabled={page <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-[9px] border border-[#e6e8eb] px-3 py-[6px] disabled:opacity-40"
                >
                  {t('expenses.page_prev')}
                </button>
                <span className="tabular-nums">
                  {page + 1}/{lastPage + 1}
                </span>
                <button
                  type="button"
                  disabled={page >= lastPage}
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  className="rounded-[9px] border border-[#e6e8eb] px-3 py-[6px] disabled:opacity-40"
                >
                  {t('expenses.page_next')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
