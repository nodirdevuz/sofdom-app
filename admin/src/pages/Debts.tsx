import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { DataTable, type Column } from '../components/DataTable';
import { KPICard } from '../components/KPICard';
import { useT } from '../i18n';
import { formatDate, formatMoney } from '../lib/format';
import { useDebtHistory, useDebtsOnDate } from '../data/useSuppliers';
import type { DebtMovement, SupplierDebtOnDate } from '../lib/suppliers';
import type { SortDir } from '../lib/expenses';

/** Движения долгов в базе начинаются 16.01.2026 — история всегда с начала года. */
const DATA_START = '2026-01-01';

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

/** «Долги»: долг каждого поставщика НА выбранную дату + история движений по клику. */
export default function Debts() {
  const t = useT();
  const [date, setDate] = useState(todayIso);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dir, setDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<SupplierDebtOnDate | null>(null);

  // debounce поиска (фильтруем на клиенте — строк ~230, всё уже загружено).
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const debts = useDebtsOnDate(date);
  const history = useDebtHistory(selected?.supplierRef ?? null, DATA_START, date);

  // KPI считаем по ПОЛНОМУ списку — поиск на итог не влияет.
  const totalDebt = useMemo(
    () => (debts.data ?? []).reduce((sum, r) => sum + r.debt, 0),
    [debts.data],
  );

  const rows = useMemo(() => {
    const sign = dir === 'asc' ? 1 : -1;
    return (debts.data ?? [])
      .filter((r) => !search || r.supplierName.toLowerCase().includes(search))
      .sort((a, b) => sign * (a.debt - b.debt));
  }, [debts.data, search, dir]);

  const columns: Column<SupplierDebtOnDate>[] = useMemo(
    () => [
      {
        key: 'name',
        label: t('suppliers.col.supplier'),
        cellClassName: 'font-medium',
        render: (r) => r.supplierName,
      },
      {
        key: 'received',
        label: t('debts.col.received'),
        align: 'right',
        render: (r) => formatMoney(r.receivedTotal),
      },
      {
        key: 'paid',
        label: t('debts.col.paid'),
        align: 'right',
        render: (r) => formatMoney(r.paidTotal),
      },
      {
        key: 'debt',
        label: `${t('debts.col.debt')} · ${formatDate(date)}`,
        align: 'right',
        render: (r) => (
          <span className={r.debt > 0 ? 'font-semibold text-[#c8332b]' : ''}>
            {formatMoney(r.debt)}
          </span>
        ),
      },
    ],
    [t, date],
  );

  const historyColumns: Column<DebtMovement>[] = useMemo(
    () => [
      { key: 'date', label: t('suppliers.col.date'), render: (r) => formatDate(r.date) },
      {
        key: 'received',
        label: t('debts.col.income'),
        align: 'right',
        render: (r) => (r.received > 0 ? formatMoney(r.received) : '—'),
      },
      {
        key: 'paid',
        label: t('debts.col.payment'),
        align: 'right',
        render: (r) => (r.paid > 0 ? formatMoney(r.paid) : '—'),
      },
      {
        key: 'debt_after',
        label: t('debts.col.debt_after'),
        align: 'right',
        render: (r) => (
          <span className={r.debtAfter > 0 ? 'font-semibold text-[#c8332b]' : 'font-semibold'}>
            {formatMoney(r.debtAfter)}
          </span>
        ),
      },
    ],
    [t],
  );

  // ---------- История движений выбранного поставщика ----------
  if (selected) {
    return (
      <>
        <header className="mb-5">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mb-2 text-[13px] font-semibold text-[#5b6b7a] hover:text-[#111418]"
          >
            {t('suppliers.back')}
          </button>
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">
            {selected.supplierName}
          </h1>
          <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">
            {t('debts.history.subtitle')} · {t('debts.col.debt')} {formatDate(date)}:{' '}
            {formatMoney(selected.debt)}
          </p>
        </header>

        {history.error && (
          <div className="mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
            {t('common.load_error')} {(history.error as Error).message}
          </div>
        )}

        {history.isLoading || !history.data ? (
          <Skeleton className="h-[420px]" />
        ) : history.data.length === 0 ? (
          <div className="rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
            {t('common.not_found')}
          </div>
        ) : (
          <DataTable
            title={t('debts.history.table.title')}
            count={history.data.length}
            columns={historyColumns}
            rows={history.data}
            rowKey={(r) => String(r.id)}
          />
        )}
      </>
    );
  }

  // ---------- Список: долг всех поставщиков на выбранную дату ----------
  return (
    <>
      <header className="mb-5">
        <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">
          {t('nav.debts')}
        </h1>
        <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">{t('debts.subtitle')}</p>
      </header>

      {debts.error && (
        <div className="mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {t('common.load_error')} {(debts.error as Error).message}
        </div>
      )}

      {debts.isLoading || !debts.data ? (
        <div className="flex flex-col gap-[15px]">
          <Skeleton className="h-[110px]" />
          <Skeleton className="h-[420px]" />
        </div>
      ) : (
        <div className="flex flex-col gap-[15px]">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[13px] font-medium text-[#56616e]" htmlFor="debtDate">
              {t('debts.date_label')}
            </label>
            <input
              id="debtDate"
              type="date"
              value={date}
              max={todayIso()}
              min={DATA_START}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className={controlClass}
            />
          </div>

          {/* grid-cols-1 на телефоне: итог 9-10 цифр не влезает в полширины карточку
              (сумма с неразрывными пробелами не переносится и вылезает за фон).
              Полная ширина — как KPI на «Пульсе»; desktop-сетка не меняется. */}
          <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-3 lg:grid-cols-5">
            <KPICard
              kpi={{
                value: formatMoney(totalDebt),
                label: `${t('debts.kpi.total')} · ${formatDate(date)}`,
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('suppliers.search_ph')}
              className={`${controlClass} min-w-[240px] flex-1`}
            />
            <button
              type="button"
              className={sortChip(true)}
              onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            >
              {t('debts.sort.debt')} {dir === 'desc' ? '↓' : '↑'}
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
              {t('common.not_found')}
            </div>
          ) : (
            <DataTable
              title={t('debts.table.title')}
              count={rows.length}
              columns={columns}
              rows={rows}
              rowKey={(r) => r.supplierRef}
              onRowClick={setSelected}
              rowClassName={(r) => (r.debt > 0 ? 'bg-[#fbeae8]/40' : '')}
            />
          )}
        </div>
      )}
    </>
  );
}
