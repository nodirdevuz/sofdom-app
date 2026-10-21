import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Pencil } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import { LoadError } from '../components/LoadError';
import { BreaksCell } from '../components/BreaksCell';
import { DataTable, type Column } from '../components/DataTable';
import { EmployeeEditModal } from '../components/EmployeeEditModal';
import { EmployeePermissionBadges } from '../components/EmployeePermissionBadges';
import { KPICard } from '../components/KPICard';
import { StatusBadge } from '../components/StatusBadge';
import { useT } from '../i18n';
import { formatDate, formatInt, formatMinutesDuration, formatMoney } from '../lib/format';
import { useAttendance, useEmployees, useSetEmployeesHidden, useStaffPurchases } from '../data/useStaff';
import type { AttendanceRow, Employee, StaffPurchaseRow } from '../lib/staff';
import type { SortDir } from '../lib/expenses';

type StaffSort = 'name' | 'balance';

// Баланс сотрудников временно скрыт (просьба владельца, 06.07.2026).
// Вернуть показ: поставить true — колонка, сортировка и KPI появятся обратно.
const SHOW_BALANCE = false;

const controlClass =
  'px-[11px] py-[7px] rounded-[9px] border border-[#e6e8eb] text-[13px] text-[#1a1f25] bg-white focus:outline-none focus:border-[#1f2937]';
const sortChip = (active: boolean) =>
  `px-[12px] py-[7px] rounded-[9px] text-[13px] font-semibold border ${
    active ? 'bg-[#1f2937] text-white border-[#1f2937]' : 'bg-white text-[#56616e] border-[#e6e8eb]'
  }`;

/** «Список»: сотрудники → клик → карточка с вкладками Табель/Покупки. */
export default function StaffList() {
  const t = useT();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [sort, setSort] = useState<StaffSort>('name');
  const [dir, setDir] = useState<SortDir>('asc');
  const [selected, setSelected] = useState<Employee | null>(null);
  // Сотрудник в окне редактирования (override поверх 1С).
  const [editing, setEditing] = useState<Employee | null>(null);
  // Отмеченные галочками для массового скрытия/возврата.
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'attendance' | 'purchases'>('attendance');
  const bulkHide = useSetEmployeesHidden();

  // debounce поиска: не дёргаем RPC на каждый символ.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const employees = useEmployees(search, activeOnly, showHidden);
  // Данные карточки: у одного сотрудника строк немного — грузим без пагинации.
  const attendance = useAttendance({ employeeRef: selected?.refKey ?? null, limit: 1000 });
  const purchases = useStaffPurchases({ employeeRef: selected?.refKey ?? null, limit: 1000 });

  // Сортировка на клиенте (~76 строк), активные всегда сверху.
  const rows = useMemo(() => {
    const sign = dir === 'asc' ? 1 : -1;
    return [...(employees.data ?? [])].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return sort === 'balance'
        ? sign * (a.balance - b.balance)
        : sign * a.name.localeCompare(b.name, 'ru');
    });
  }, [employees.data, sort, dir]);

  function toggleSort(next: StaffSort) {
    if (sort === next) setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSort(next);
      setDir(next === 'balance' ? 'desc' : 'asc');
    }
  }

  const columns: Column<Employee>[] = useMemo(
    () => [
      {
        key: 'name',
        label: t('staff.col.name'),
        cellClassName: 'font-medium',
        render: (r) => r.name,
      },
      {
        key: 'job',
        label: t('staff.col.job'),
        render: (r) =>
          [r.jobTitle, r.department].filter(Boolean).join(' · ') || '—',
      },
      { key: 'phone', label: t('staff.col.phone'), render: (r) => r.phone || '—' },
      ...(SHOW_BALANCE
        ? [
            {
              key: 'balance',
              label: t('staff.col.balance'),
              align: 'right',
              render: (r) => (
                <span className={r.balance < 0 ? 'font-semibold text-[#c8332b]' : 'font-semibold'}>
                  {formatMoney(r.balance)}
                </span>
              ),
            } satisfies Column<Employee>,
          ]
        : []),
      {
        key: 'status',
        label: t('staff.col.status'),
        render: (r) => (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {/* Ключик: зелёный — логин/пароль кабинета выданы, бледный — ещё нет. */}
            <span title={r.hasAccess ? t('staff.access.on') : t('staff.access.off')}>
              <KeyRound
                size={14}
                strokeWidth={2}
                aria-label={r.hasAccess ? t('staff.access.on') : t('staff.access.off')}
                className={r.hasAccess ? 'text-[#1b7a3d]' : 'text-[#8a94a0] opacity-40'}
              />
            </span>
            <EmployeePermissionBadges permissions={r.permissions} />
            <StatusBadge
              tone={r.isActive ? 'pos' : 'neu'}
              label={r.isActive ? t('staff.status.active') : t('staff.status.fired')}
            />
            {r.isHidden && <StatusBadge tone="dark" label={t('staff.hidden_badge')} />}
          </span>
        ),
      },
      {
        key: 'actions',
        label: '',
        align: 'right',
        render: (r) => (
          <span className="inline-flex items-center gap-2.5">
            {/* Галочка массового скрытия. stopPropagation — не проваливаться в карточку. */}
            <input
              type="checkbox"
              aria-label={t('staff.bulk.select')}
              checked={checked.has(r.refKey)}
              onClick={(e) => e.stopPropagation()}
              onChange={() =>
                setChecked((prev) => {
                  const next = new Set(prev);
                  if (next.has(r.refKey)) next.delete(r.refKey);
                  else next.add(r.refKey);
                  return next;
                })
              }
            />
            <button
              type="button"
              aria-label={t('staff.edit.aria')}
              title={t('staff.edit.aria')}
              onClick={(e) => {
                e.stopPropagation();
                setEditing(r);
              }}
              className="rounded-[7px] p-1.5 text-[#8a94a0] hover:bg-[#f2f3f5] hover:text-[#1a1f25]"
            >
              <Pencil size={16} strokeWidth={1.8} />
            </button>
          </span>
        ),
      },
    ],
    [t, checked],
  );

  const attendanceColumns: Column<AttendanceRow>[] = useMemo(
    () => [
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

  const purchaseColumns: Column<StaffPurchaseRow>[] = useMemo(
    () => [
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

  // ---------- Карточка сотрудника ----------
  if (selected) {
    const tabQuery = tab === 'attendance' ? attendance : purchases;
    return (
      <>
        <header className="mb-5">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mb-2 text-[13px] font-semibold text-[#5b6b7a] hover:text-[#111418]"
          >
            {t('staff.back')}
          </button>
          <div className="flex items-center gap-2.5">
            <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">
              {selected.name}
            </h1>
            <StatusBadge
              tone={selected.isActive ? 'pos' : 'neu'}
              label={selected.isActive ? t('staff.status.active') : t('staff.status.fired')}
            />
          </div>
          <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">
            {[
              [selected.jobTitle, selected.department].filter(Boolean).join(' · '),
              selected.phone,
              selected.hiredAt ? `${t('staff.hired')}: ${formatDate(selected.hiredAt)}` : '',
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
        </header>

        <div className="flex flex-col gap-[15px]">
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-5">
            {SHOW_BALANCE && (
              <KPICard kpi={{ value: formatMoney(selected.balance), label: t('staff.col.balance') }} />
            )}
            <KPICard kpi={{ value: formatMoney(selected.totalReceived), label: t('staff.kpi.received') }} />
            <KPICard kpi={{ value: formatMoney(selected.totalCredited), label: t('staff.kpi.credited') }} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={sortChip(tab === 'attendance')} onClick={() => setTab('attendance')}>
              {t('staff.tab.attendance')}
            </button>
            <button type="button" className={sortChip(tab === 'purchases')} onClick={() => setTab('purchases')}>
              {t('staff.tab.purchases')}
            </button>
          </div>

          {!tabQuery.data && tabQuery.error ? (
            <LoadError error={tabQuery.error} onRetry={() => void tabQuery.refetch()} />
          ) : tabQuery.isLoading || !tabQuery.data ? (
            <Skeleton className="h-[420px]" />
          ) : tab === 'attendance' ? (
            attendance.data!.rows.length === 0 ? (
              <div className="rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
                {t('common.not_found')}
              </div>
            ) : (
              <DataTable
                title={t('staff.tab.attendance')}
                count={attendance.data!.totalCount}
                columns={attendanceColumns}
                rows={attendance.data!.rows}
                rowKey={(r) => `${r.date}-${r.employeeRef}`}
                mobileCards
              />
            )
          ) : purchases.data!.rows.length === 0 ? (
            <div className="rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
              {t('common.not_found')}
            </div>
          ) : (
            <DataTable
              title={t('staff.tab.purchases')}
              count={purchases.data!.totalCount}
              columns={purchaseColumns}
              rows={purchases.data!.rows}
              rowKey={(r) => String(r.id)}
              mobileCards
            />
          )}
        </div>
      </>
    );
  }

  // ---------- Список сотрудников ----------
  return (
    <>
      <header className="mb-5">
        <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">
          {t('nav.staff_list')}
        </h1>
        <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">{t('staff.list.subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('staff.search_ph')}
          className={`${controlClass} min-w-[240px] flex-1`}
        />
        <label className="flex items-center gap-2 text-[13px] text-[#56616e]">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          {t('staff.filter.active_only')}
        </label>
        <label className="flex items-center gap-2 text-[13px] text-[#56616e]">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          {t('staff.filter.show_hidden')}
        </label>
        <button type="button" className={sortChip(sort === 'name')} onClick={() => toggleSort('name')}>
          {t('suppliers.sort.name')} {sort === 'name' ? (dir === 'desc' ? '↓' : '↑') : ''}
        </button>
        {SHOW_BALANCE && (
          <button type="button" className={sortChip(sort === 'balance')} onClick={() => toggleSort('balance')}>
            {t('staff.sort.balance')} {sort === 'balance' ? (dir === 'desc' ? '↓' : '↑') : ''}
          </button>
        )}
        {checked.size > 0 && (
          <>
            <button
              type="button"
              disabled={bulkHide.isPending}
              className={`${sortChip(true)} disabled:opacity-60`}
              onClick={() =>
                void bulkHide
                  .mutateAsync({ refs: [...checked], hidden: true })
                  .then(() => setChecked(new Set()))
              }
            >
              {t('staff.bulk.hide')} ({checked.size})
            </button>
            {showHidden && (
              <button
                type="button"
                disabled={bulkHide.isPending}
                className={`${sortChip(false)} disabled:opacity-60`}
                onClick={() =>
                  void bulkHide
                    .mutateAsync({ refs: [...checked], hidden: false })
                    .then(() => setChecked(new Set()))
                }
              >
                {t('staff.bulk.unhide')} ({checked.size})
              </button>
            )}
          </>
        )}
      </div>

      {bulkHide.error && (
        <div className="mt-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {t('common.load_error')} {(bulkHide.error as Error).message}
        </div>
      )}

      {/* Ошибка сильнее загрузки: при провале данных нет, и прежнее условие
          `isLoading || !data` крутило скелетон вечно — ровно та жалоба 15.09. */}
      {!employees.data && employees.error ? (
        <div className="mt-[26px]">
          <LoadError error={employees.error} onRetry={() => void employees.refetch()} />
        </div>
      ) : employees.isLoading || !employees.data ? (
        <div className="mt-[26px]">
          <Skeleton className="h-[420px]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-[26px] rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
          {t('common.not_found')}
        </div>
      ) : (
        <DataTable
          title={t('staff.table.title')}
          count={rows.length}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.refKey}
          mobileCards
          onRowClick={(r) => {
            setSelected(r);
            setTab('attendance');
          }}
        />
      )}

      {editing && <EmployeeEditModal employee={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
