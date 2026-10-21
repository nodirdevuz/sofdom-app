import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { DataTable, type Column } from '../components/DataTable';
import { useT } from '../i18n';
import { formatDate, formatInt, formatMoney } from '../lib/format';
import { useSupplierPurchases, useSuppliersSummary } from '../data/useSuppliers';
import {
  sortSuppliers,
  type SupplierPurchase,
  type SupplierSort,
  type SupplierSummary,
} from '../lib/suppliers';
import type { SortDir } from '../lib/expenses';

const controlClass =
  'px-[11px] py-[7px] rounded-[9px] border border-[#e6e8eb] text-[13px] text-[#1a1f25] bg-white focus:outline-none focus:border-[#1f2937]';
const sortChip = (active: boolean) =>
  `px-[12px] py-[7px] rounded-[9px] text-[13px] font-semibold border ${
    active ? 'bg-[#1f2937] text-white border-[#1f2937]' : 'bg-white text-[#56616e] border-[#e6e8eb]'
  }`;

/** «Закупки»: все поставщики (сумма DESC) → клик → приходы поставщика. */
export default function Deliveries() {
  const t = useT();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SupplierSort>('amount');
  const [dir, setDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<SupplierSummary | null>(null);

  // debounce поиска: не дёргаем RPC на каждый символ.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const summary = useSuppliersSummary(search);
  const purchases = useSupplierPurchases(selected?.supplierRef ?? null);

  // Сортировка на клиенте: поставщиков ~230, сервер уже отдал агрегаты.
  const rows = useMemo(() => sortSuppliers(summary.data ?? [], sort, dir), [summary.data, sort, dir]);

  function toggleSort(next: SupplierSort) {
    if (sort === next) setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSort(next);
      setDir('desc');
    }
  }

  const supplierColumns: Column<SupplierSummary>[] = useMemo(
    () => [
      {
        key: 'name',
        label: t('suppliers.col.supplier'),
        cellClassName: 'font-medium',
        render: (r) => r.supplierName,
      },
      {
        key: 'total',
        label: t('suppliers.col.total'),
        align: 'right',
        cellClassName: 'font-semibold',
        render: (r) => formatMoney(r.totalAmount),
      },
      {
        key: 'deliveries',
        label: t('suppliers.col.deliveries'),
        align: 'right',
        render: (r) => formatInt(r.deliveriesCount),
      },
      {
        key: 'last_date',
        label: t('suppliers.col.last_date'),
        align: 'right',
        render: (r) => formatDate(r.lastDate),
      },
    ],
    [t],
  );

  const purchaseColumns: Column<SupplierPurchase>[] = useMemo(
    () => [
      { key: 'date', label: t('suppliers.col.date'), render: (r) => formatDate(r.date) },
      {
        key: 'product',
        label: t('suppliers.col.product'),
        render: (r) => <span className="whitespace-normal">{r.productName}</span>,
      },
      { key: 'qty', label: t('suppliers.col.qty'), align: 'right', render: (r) => formatInt(r.qty) },
      {
        key: 'price',
        label: t('suppliers.col.price'),
        align: 'right',
        render: (r) => formatMoney(r.purchasePrice),
      },
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

  // ---------- Детализация: приходы выбранного поставщика ----------
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
            {t('suppliers.detail.subtitle')} · {formatMoney(selected.totalAmount)} ·{' '}
            {t('suppliers.col.deliveries')}: {formatInt(selected.deliveriesCount)}
          </p>
        </header>

        {purchases.error && (
          <div className="mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
            {t('common.load_error')} {(purchases.error as Error).message}
          </div>
        )}

        {purchases.isLoading || !purchases.data ? (
          <Skeleton className="h-[420px]" />
        ) : purchases.data.length === 0 ? (
          <div className="rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
            {t('common.not_found')}
          </div>
        ) : (
          <DataTable
            title={t('suppliers.detail.table.title')}
            count={purchases.data.length}
            columns={purchaseColumns}
            rows={purchases.data}
            rowKey={(r) => String(r.id)}
          />
        )}
      </>
    );
  }

  // ---------- Список поставщиков ----------
  return (
    <>
      <header className="mb-5">
        <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">
          {t('nav.deliveries')}
        </h1>
        <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">{t('suppliers.purchases.subtitle')}</p>
      </header>

      {summary.error && (
        <div className="mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {t('common.load_error')} {(summary.error as Error).message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('suppliers.search_ph')}
          className={`${controlClass} min-w-[240px] flex-1`}
        />
        <button type="button" className={sortChip(sort === 'amount')} onClick={() => toggleSort('amount')}>
          {t('suppliers.sort.amount')} {sort === 'amount' ? (dir === 'desc' ? '↓' : '↑') : ''}
        </button>
        <button type="button" className={sortChip(sort === 'name')} onClick={() => toggleSort('name')}>
          {t('suppliers.sort.name')} {sort === 'name' ? (dir === 'desc' ? '↓' : '↑') : ''}
        </button>
        <button type="button" className={sortChip(sort === 'date')} onClick={() => toggleSort('date')}>
          {t('suppliers.sort.date')} {sort === 'date' ? (dir === 'desc' ? '↓' : '↑') : ''}
        </button>
      </div>

      {summary.isLoading || !summary.data ? (
        <div className="mt-[26px]">
          <Skeleton className="h-[420px]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-[26px] rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
          {t('common.not_found')}
        </div>
      ) : (
        <DataTable
          title={t('suppliers.table.title')}
          count={rows.length}
          columns={supplierColumns}
          rows={rows}
          rowKey={(r) => r.supplierRef}
          onRowClick={setSelected}
        />
      )}
    </>
  );
}
