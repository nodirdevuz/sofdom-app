import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { BreaksCell } from '../components/BreaksCell';
import { DataTable, type Column } from '../components/DataTable';
import { KPICard } from '../components/KPICard';
import { StatusBadge } from '../components/StatusBadge';
import { useT } from '../i18n';
import { formatDate, formatInt, formatMinutesDuration, formatMoney } from '../lib/format';
import { useAttendanceDay, useAttendanceDaySummary } from '../data/useStaff';
import type { AttendanceDayRow, AttendanceDayStatus } from '../lib/staff';
import type { SortDir } from '../lib/expenses';
import type { StatusTone } from '../types';
import type { TranslationKey } from '../i18n/dictionaries/ru';

type ControlSort = 'came' | 'late';

const controlClass =
  'px-[11px] py-[7px] rounded-[9px] border border-[#e6e8eb] text-[13px] text-[#1a1f25] bg-white focus:outline-none focus:border-[#1f2937]';
const sortChip = (active: boolean) =>
  `px-[12px] py-[7px] rounded-[9px] text-[13px] font-semibold border ${
    active ? 'bg-[#1f2937] text-white border-[#1f2937]' : 'bg-white text-[#56616e] border-[#e6e8eb]'
  }`;

/** Сегодня в локальной зоне как YYYY-MM-DD (для input type=date). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Бейдж статуса явки: тон и подпись по статусу из RPC. */
const STATUS_VIEW: Record<AttendanceDayStatus, { tone: StatusTone; labelKey: TranslationKey }> = {
  on_site: { tone: 'pos', labelKey: 'control.status.on_site' },
  left: { tone: 'dark', labelKey: 'control.status.left' },
  late: { tone: 'neg', labelKey: 'control.status.late' },
  absent: { tone: 'neu', labelKey: 'control.status.absent' },
};

/** «Контроль» (келди-кетди): явка всех сотрудников за выбранный день, чистая картина без дублей. */
export default function StaffControl() {
  const t = useT();
  const [date, setDate] = useState(todayIso);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ControlSort>('came');
  const [dir, setDir] = useState<SortDir>('asc');

  // debounce поиска (фильтруем на клиенте — строк ~44, всё уже загружено).
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const day = useAttendanceDay(date);
  const summary = useAttendanceDaySummary(date);

  function toggleSort(next: ControlSort) {
    if (sort === next) setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSort(next);
      // По приходу смотрят с утра (ранние сверху), по опозданию — худшие сверху.
      setDir(next === 'late' ? 'desc' : 'asc');
    }
  }

  const rows = useMemo(() => {
    const sign = dir === 'asc' ? 1 : -1;
    return (day.data ?? [])
      .filter((r) => !search || r.employeeName.toLowerCase().includes(search))
      .sort((a, b) => {
        if (sort === 'late') return sign * (a.lateHours - b.lateHours);
        // По приходу: не отметившиеся всегда внизу, дальше по времени 'HH:MM'.
        if (!a.cameAt !== !b.cameAt) return a.cameAt ? -1 : 1;
        return sign * (a.cameAt ?? '').localeCompare(b.cameAt ?? '');
      });
  }, [day.data, search, sort, dir]);

  const columns: Column<AttendanceDayRow>[] = useMemo(
    () => [
      {
        key: 'name',
        label: t('staff.col.employee'),
        cellClassName: 'font-medium',
        render: (r) => r.employeeName,
      },
      { key: 'came', label: t('staff.col.came'), align: 'right', render: (r) => r.cameAt ?? '—' },
      { key: 'left', label: t('staff.col.left'), align: 'right', render: (r) => r.leftAt ?? '—' },
      {
        key: 'late',
        label: t('staff.col.late'),
        align: 'right',
        render: (r) =>
          r.wasLate ? (
            <span className="font-semibold text-[#c8332b]">
              {formatMinutesDuration(r.lateHours, t('staff.hours_short'), t('staff.min_short'))}
            </span>
          ) : (
            '—'
          ),
      },
      {
        key: 'breaks',
        label: t('staff.col.breaks'),
        align: 'right',
        render: (r) => <BreaksCell breaks={r.breaks} />,
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
        key: 'status',
        label: t('staff.col.status'),
        render: (r) => {
          const v = STATUS_VIEW[r.status] ?? STATUS_VIEW.absent;
          return <StatusBadge tone={v.tone} label={t(v.labelKey)} />;
        },
      },
    ],
    [t],
  );

  return (
    <>
      <header className="mb-5">
        <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">
          {t('nav.staff_control')}
        </h1>
        <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">{t('control.subtitle')}</p>
      </header>

      {(day.error || summary.error) && (
        <div className="mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {t('common.load_error')} {((day.error ?? summary.error) as Error).message}
        </div>
      )}

      {day.isLoading || summary.isLoading || !day.data || !summary.data ? (
        <div className="flex flex-col gap-[15px]">
          <Skeleton className="h-[110px]" />
          <Skeleton className="h-[420px]" />
        </div>
      ) : (
        <div className="flex flex-col gap-[15px]">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[13px] font-medium text-[#56616e]" htmlFor="controlDate">
              {t('control.date_label')}
            </label>
            <input
              id="controlDate"
              type="date"
              value={date}
              max={todayIso()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className={controlClass}
            />
          </div>

          {/* KPI дня — сетка как на «Пульсе»: на телефоне карточки в столбик, полной ширины. */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(218px,1fr))] gap-[15px]">
            <KPICard kpi={{ value: formatInt(summary.data.cameCount), label: t('control.kpi.came') }} />
            <KPICard kpi={{ value: formatInt(summary.data.lateCount), label: t('control.kpi.late') }} />
            <KPICard kpi={{ value: formatMoney(summary.data.finesTotal), label: t('control.kpi.fines') }} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('staff.search_ph')}
              className={`${controlClass} min-w-[240px] flex-1`}
            />
            <button type="button" className={sortChip(sort === 'came')} onClick={() => toggleSort('came')}>
              {t('control.sort.came')} {sort === 'came' ? (dir === 'desc' ? '↓' : '↑') : ''}
            </button>
            <button type="button" className={sortChip(sort === 'late')} onClick={() => toggleSort('late')}>
              {t('control.sort.late')} {sort === 'late' ? (dir === 'desc' ? '↓' : '↑') : ''}
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
              {t('common.not_found')}
            </div>
          ) : (
            <DataTable
              title={`${t('control.table.title')} · ${formatDate(date)}`}
              count={rows.length}
              columns={columns}
              rows={rows}
              rowKey={(r) => r.employeeRef}
              rowClassName={(r) => (r.status === 'late' ? 'bg-[#fbeae8]/40' : '')}
              mobileCards
            />
          )}
        </div>
      )}
    </>
  );
}
