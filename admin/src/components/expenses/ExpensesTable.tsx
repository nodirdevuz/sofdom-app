import { useEffect, useMemo, useState } from 'react';
import { DataTable, type Column } from '../DataTable';
import { formatMoney } from '../../lib/format';
import { useT } from '../../i18n';
import type { ResolvedPeriod } from '../../lib/period';
import { useExpensesRows } from '../../data/useExpenses';
import {
  REASON_KEY,
  REASONS,
  type ExpenseRow,
  type ExpenseSort,
  type SortDir,
} from '../../lib/expenses';

const PAGE_SIZE = 50;

/** Таблица расходов: серверный поиск/фильтры/сортировка/пагинация + бейдж долга. */
export function ExpensesTable({
  period,
  cashiers,
  debtsOnly,
}: {
  period: ResolvedPeriod;
  cashiers: string[];
  debtsOnly: boolean;
}) {
  const t = useT();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState<string>('');
  const [cashier, setCashier] = useState<string>('');
  const [sort, setSort] = useState<ExpenseSort>('date');
  const [dir, setDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  // debounce поиска: не дёргаем RPC на каждый символ.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Любая смена фильтра/поиска/сортировки/периода/режима долгов → на первую страницу.
  useEffect(() => {
    setPage(0);
  }, [search, reason, cashier, sort, dir, debtsOnly, period.current.from, period.current.to]);

  const query = useExpensesRows(period, {
    search,
    reason: reason || null,
    cashier: cashier || null,
    debtsOnly,
    sort,
    dir,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const data = query.data;
  const rows = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalAmount = data?.totalAmount ?? 0;
  const lastPage = Math.max(0, Math.ceil(totalCount / PAGE_SIZE) - 1);

  function toggleSort(next: ExpenseSort) {
    if (sort === next) setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSort(next);
      setDir('desc');
    }
  }

  const columns: Column<ExpenseRow>[] = useMemo(
    () => [
      { key: 'date', label: t('expenses.col.date'), render: (r) => r.date },
      {
        key: 'cashier',
        label: t('expenses.col.cashier'),
        render: (r) => r.cashier ?? t('expenses.no_cashier'),
      },
      {
        key: 'reason',
        label: t('expenses.col.category'),
        render: (r) => (REASON_KEY[r.reason] ? t(REASON_KEY[r.reason]) : r.reason),
      },
      {
        key: 'amount',
        label: t('expenses.col.amount'),
        align: 'right',
        cellClassName: 'font-semibold',
        render: (r) => formatMoney(r.amount),
      },
      {
        key: 'note',
        label: t('expenses.col.note'),
        render: (r) => (
          <span className="flex items-center gap-1.5 whitespace-normal">
            <span>{r.note ?? '—'}</span>
            {r.isDebt && (
              <span className="shrink-0 rounded-full bg-[#fbeae8] px-1.5 py-[1px] text-[11px] font-semibold text-[#c8332b]">
                {t('expenses.badge.debt')}
              </span>
            )}
          </span>
        ),
      },
    ],
    [t],
  );

  const controlClass =
    'px-[11px] py-[7px] rounded-[9px] border border-[#e6e8eb] text-[13px] text-[#1a1f25] bg-white focus:outline-none focus:border-[#1f2937]';
  const sortChip = (active: boolean) =>
    `px-[12px] py-[7px] rounded-[9px] text-[13px] font-semibold border ${
      active ? 'bg-[#1f2937] text-white border-[#1f2937]' : 'bg-white text-[#56616e] border-[#e6e8eb]'
    }`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('expenses.search_ph')}
          className={`${controlClass} min-w-[240px] flex-1`}
        />
        <select className={controlClass} value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">{t('expenses.filter.all_categories')}</option>
          {REASONS.map((rs) => (
            <option key={rs} value={rs}>
              {REASON_KEY[rs] ? t(REASON_KEY[rs]) : rs}
            </option>
          ))}
        </select>
        <select className={controlClass} value={cashier} onChange={(e) => setCashier(e.target.value)}>
          <option value="">{t('expenses.filter.all_cashiers')}</option>
          {cashiers.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="button" className={sortChip(sort === 'amount')} onClick={() => toggleSort('amount')}>
          {t('expenses.sort.amount')} {sort === 'amount' ? (dir === 'desc' ? '↓' : '↑') : ''}
        </button>
        <button type="button" className={sortChip(sort === 'date')} onClick={() => toggleSort('date')}>
          {t('expenses.sort.date')} {sort === 'date' ? (dir === 'desc' ? '↓' : '↑') : ''}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
          {t('expenses.empty')}
        </div>
      ) : (
        <DataTable
          title={t('expenses.table.title')}
          count={totalCount}
          columns={columns}
          rows={rows}
          rowKey={(r) => String(r.id)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-[#8a94a0]">
        <span>{t('expenses.rows_total', { count: totalCount, amount: formatMoney(totalAmount) })}</span>
        <span className="flex items-center gap-2">
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
        </span>
      </div>
    </div>
  );
}
