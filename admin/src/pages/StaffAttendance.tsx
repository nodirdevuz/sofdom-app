import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { BreaksCell } from '../components/BreaksCell';
import { DataTable, type Column } from '../components/DataTable';
import { PeriodSwitcher } from '../components/dashboard/PeriodSwitcher';
import { usePeriod } from '../hooks/usePeriod';
import { useT } from '../i18n';
import { periodLabel } from '../lib/period';
import { formatDate, formatInt, formatMinutesDuration, formatMoney } from '../lib/format';
import { useAttendance, useAttendanceSummary } from '../data/useStaff';
import type { AttendanceRow, AttendanceSummaryRow } from '../lib/staff';

const PAGE_SIZE = 50;

/** «Табель»: итоги по сотрудникам + строки за период, опоздания/штрафы красным. */
export default function StaffAttendance() {
  const t = useT();
  const { preset, custom, period, setPreset, handleCustomChange } = usePeriod('last30');
  const [page, setPage] = useState(0);

  // Смена периода → на первую страницу.
  useEffect(() => {
    setPage(0);
  }, [period.current.from, period.current.to]);

  const summary = useAttendanceSummary(period.current.from, period.current.to);
  const rowsQuery = useAttendance({
    from: period.current.from,
    to: period.current.to,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const totalCount = rowsQuery.data?.totalCount ?? 0;
  const lastPage = Math.max(0, Math.ceil(totalCount / PAGE_SIZE) - 1);

  const summaryColumns: Column<AttendanceSummaryRow>[] = useMemo(
    () => [
      {
        key: 'name',
        label: t('staff.col.employee'),
        cellClassName: 'font-medium',
        render: (r) => r.employeeName,
      },
      { key: 'days', label: t('staff.col.days'), align: 'right', render: (r) => formatInt(r.days) },
      {
        key: 'lates',
        label: t('staff.col.lates'),
        align: 'right',
        render: (r) =>
          r.lates > 0 ? (
            <span className="font-semibold text-[#c8332b]">{formatInt(r.lates)}</span>
          ) : (
            '0'
          ),
      },
      {
        key: 'breaks',
        label: t('staff.col.breaks'),
        align: 'right',
        render: (r) =>
          r.breaksTotalMinutes > 0
            ? formatMinutesDuration(r.breaksTotalMinutes, t('staff.hours_short'), t('staff.min_short'))
            : '—',
      },
      {
        key: 'fines',
        label: t('staff.col.fines'),
        align: 'right',
        render: (r) =>
          r.fines > 0 ? (
            <span className="font-semibold text-[#c8332b]">{formatMoney(r.fines)}</span>
          ) : (
            '—'
          ),
      },
      {
        key: 'deductions',
        label: t('staff.col.deductions'),
        align: 'right',
        render: (r) =>
          r.deductionsTotal > 0 ? (
            <span className="font-semibold text-[#c8332b]">{formatMoney(r.deductionsTotal)}</span>
          ) : (
            '—'
          ),
      },
    ],
    [t],
  );

  const rowColumns: Column<AttendanceRow>[] = useMemo(
    () => [
      {
        key: 'name',
        label: t('staff.col.employee'),
        cellClassName: 'font-medium',
        render: (r) => r.employeeName,
      },
      { key: 'date', label: t('suppliers.col.date'), render: (r) => formatDate(r.date) },
      { key: 'came', label: t('staff.col.came'), align: 'right', render: (r) => r.cameAt ?? '—' },
      {
        key: 'left',
        label: t('staff.col.left'),
        align: 'right',
        render: (r) =>
          r.leftAt ??
          (r.onSite ? (
            <span className="font-semibold text-[#1b7a3d]">{t('control.status.on_site')}</span>
          ) : (
            '—'
          )),
      },
      {
        key: 'late',
        label: t('staff.col.late'),
        align: 'right',
        render: (r) =>
          r.wasLate ? (
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-[#c8332b]">
                {formatMinutesDuration(r.lateHours, t('staff.hours_short'), t('staff.min_short'))}
              </span>
              {r.lateDeduction > 0 && (
                <span className="text-[12px] font-semibold text-[#c8332b]">
                  −{formatMoney(r.lateDeduction)}
                </span>
              )}
            </div>
          ) : (
            '—'
          ),
      },
      {
        key: 'breaks',
        label: t('staff.col.breaks'),
        align: 'right',
        render: (r) => <BreaksCell breaks={r.breaks} deduction={r.breakDeduction} />,
      },
      {
        key: 'rate',
        label: t('staff.col.rate'),
        align: 'right',
        render: (r) => (r.rate > 0 ? formatMoney(r.rate) : '—'),
      },
      {
        key: 'fine',
        label: t('staff.col.fine'),
        align: 'right',
        render: (r) =>
          r.fine > 0 ? (
            <span className="font-semibold text-[#c8332b]">{formatMoney(r.fine)}</span>
          ) : (
            '—'
          ),
      },
      {
        key: 'earned',
        label: t('staff.col.earned'),
        align: 'right',
        cellClassName: 'font-semibold',
        render: (r) => (r.rate > 0 ? formatMoney(r.earned) : '—'),
      },
    ],
    [t],
  );

  return (
    <>
      <header className="mb-5 flex flex-col gap-4">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">
            {t('nav.staff_attendance')}
          </h1>
          <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">
            {t('staff.att.subtitle')} · {periodLabel(preset, period, t)}
          </p>
        </div>
        <PeriodSwitcher
          preset={preset}
          custom={custom}
          onPresetChange={setPreset}
          onCustomChange={handleCustomChange}
        />
      </header>

      {(summary.error || rowsQuery.error) && (
        <div className="mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {t('common.load_error')} {((summary.error ?? rowsQuery.error) as Error).message}
        </div>
      )}

      {summary.isLoading || rowsQuery.isLoading || !summary.data || !rowsQuery.data ? (
        <div className="flex flex-col gap-[15px]">
          <Skeleton className="h-[320px]" />
          <Skeleton className="h-[420px]" />
        </div>
      ) : (
        <div className="flex flex-col gap-[15px]">
          {summary.data.length === 0 ? (
            <div className="rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
              {t('common.not_found')}
            </div>
          ) : (
            <DataTable
              title={t('staff.att.summary.title')}
              count={summary.data.length}
              columns={summaryColumns}
              rows={summary.data}
              rowKey={(r) => r.employeeRef}
              rowClassName={(r) => (r.fines > 0 ? 'bg-[#fbeae8]/40' : '')}
              mobileCards
            />
          )}

          {rowsQuery.data.rows.length > 0 && (
            <>
              <DataTable
                title={t('staff.att.table.title')}
                count={totalCount}
                columns={rowColumns}
                rows={rowsQuery.data.rows}
                rowKey={(r) => `${r.date}-${r.employeeRef}`}
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
