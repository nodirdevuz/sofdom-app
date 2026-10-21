import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { useAllProducts } from '../data/useAllProducts';
import { formatInt, formatMoney } from '../lib/format';
import { downloadXlsx, todayStamp } from '../lib/xlsx';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/dictionaries/ru';
import type { ProductLatest } from '../types';

type SortKey = 'name' | 'purchase_price' | 'sale_price' | 'stock';
type SortDir = 'asc' | 'desc';

interface ColumnDef {
  key: SortKey;
  labelKey: TranslationKey;
  align: 'left' | 'right';
  render: (p: ProductLatest) => string;
}

const COLUMNS: ColumnDef[] = [
  { key: 'name', labelKey: 'products.col.name', align: 'left', render: (p) => p.name },
  {
    key: 'purchase_price',
    labelKey: 'products.col.purchase',
    align: 'right',
    render: (p) => (p.purchase_price === null ? '—' : formatMoney(p.purchase_price)),
  },
  {
    key: 'sale_price',
    labelKey: 'products.col.sale',
    align: 'right',
    render: (p) => (p.sale_price === null ? '—' : formatMoney(p.sale_price)),
  },
  {
    key: 'stock',
    labelKey: 'products.col.stock',
    align: 'right',
    render: (p) => (p.stock === null ? '—' : formatInt(p.stock)),
  },
];

export default function AllProducts() {
  const t = useT();
  const { products, isLoading, error } = useAllProducts();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'ru') * dir;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null) return 1; // пустые значения — в конец
      if (bv === null) return -1;
      return (av - bv) * dir;
    });
  }, [products, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }

  // Экспорт текущей таблицы (с учётом поиска и сортировки) в .xlsx.
  // Числа выгружаем числами — Excel сможет сортировать и считать.
  function handleExport() {
    downloadXlsx(
      `tovary_${todayStamp()}.xlsx`,
      [
        { header: t('products.col.name'), width: 44 },
        { header: t('products.col.purchase'), width: 14 },
        { header: t('products.col.sale'), width: 14 },
        { header: t('products.col.stock'), width: 12 },
      ],
      rows.map((p) => [p.name, p.purchase_price, p.sale_price, p.stock]),
    );
  }

  return (
    <>
      <PageHeader
        title={t('nav.products')}
        subtitle={t('products.subtitle')}
        onExport={handleExport}
      />

      <div className="mt-[22px] flex flex-wrap items-center gap-x-4 gap-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('products.search_ph')}
          className="w-full max-w-[380px] px-3.5 py-2 border border-[#e6e8eb] rounded-[9px] text-sm text-[#1a1f25] bg-white outline-none transition-colors focus:border-[#c2c8cf] placeholder:text-[#9aa4b0]"
        />
        <div className="text-sm text-[#56616e]">
          {isLoading ? (
            t('common.loading')
          ) : (
            <>
              {t('products.shown')}{' '}
              <span className="font-semibold text-[#1a1f25] tabular-nums">{rows.length}</span>
              {rows.length !== products.length && (
                <span className="text-[#8a94a0]"> {t('products.of')} {products.length}</span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-4 border border-[#ecedf0] rounded-[14px] overflow-hidden bg-white">
        <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-b border-[#f1f2f4]">
          <div className="text-base font-semibold">{t('products.table_title')}</div>
          <div className="text-[12.5px] text-[#8a94a0] font-medium bg-[#f3f4f6] px-2.5 py-[3px] rounded-full">
            {isLoading ? '…' : rows.length}
          </div>
        </div>

        {error ? (
          <div className="px-5 py-12 text-center text-sm text-[#c8332b]">{t('common.load_error')} {error}</div>
        ) : isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-[#8a94a0]">{t('common.loading')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className={`px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold whitespace-nowrap cursor-pointer select-none transition-colors hover:text-[#5b6b7a] ${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {t(col.labelKey)}
                      {sortKey === col.key && (
                        <span className="ml-1 text-[#5b6b7a]">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-[#fafbfc]">
                    {COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className={`px-5 py-[13px] border-b border-[#f3f4f6] text-sm tabular-nums ${
                          col.align === 'right' ? 'text-right whitespace-nowrap' : 'text-left'
                        } ${
                          col.key === 'name'
                            ? 'text-[#1a1f25] font-semibold'
                            : 'text-[#3a4654] font-medium'
                        }`}
                      >
                        {col.render(p)}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-5 py-12 text-center text-sm text-[#8a94a0]">
                      {t('common.not_found')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
