import { useMemo, useState } from 'react';
import { PeriodSwitcher } from '../components/dashboard/PeriodSwitcher';
import { ProductSalesTable } from '../components/products-analytics/ProductSalesTable';
import { useProductSales } from '../data/useProductSales';
import { usePeriod } from '../hooks/usePeriod';
import { ExcelButton } from '../components/ExcelButton';
import { useT } from '../i18n';
import { formatInt, formatMoney } from '../lib/format';
import { periodStamp } from '../lib/xlsx';
import { downloadReport, type ReportColumn, type AccentColor, type CellValue } from '../lib/excelReport';
import { periodLabel, type PeriodPreset } from '../lib/period';
import { margin, revenueDelta, type ProductSalesRow, type ProductSortKey, type TopN } from '../lib/productSales';

const PSALES_PRESETS: PeriodPreset[] = ['last30', 'last60', 'last90', 'custom'];
const TOP_OPTIONS: TopN[] = [30, 100, 'all'];

function chipClass(active: boolean): string {
  return [
    'px-[14px] py-[7px] rounded-[9px] text-[13px] font-semibold whitespace-nowrap transition-colors border',
    active
      ? 'bg-[#1f2937] text-white border-[#1f2937]'
      : 'bg-white text-[#56616e] border-[#e6e8eb] hover:bg-[#f7f8f9]',
  ].join(' ');
}

/** Числовое значение строки по ключу сортировки (имя сортируется отдельно). */
function sortNum(r: ProductSalesRow, key: ProductSortKey): number {
  switch (key) {
    case 'margin': return margin(r.revenue, r.profit);
    case 'qty': return r.qty;
    case 'receipts': return r.receipts;
    case 'revenue': return r.revenue;
    case 'profit': return r.profit;
    case 'avgPrice': return r.avgPrice;
    default: return 0;
  }
}

export default function ProductAnalytics() {
  const t = useT();
  const { preset, custom, period, setPreset, handleCustomChange } = usePeriod('last30');
  const [compare, setCompare] = useState(false);
  const [search, setSearch] = useState('');
  const [topN, setTopN] = useState<TopN>(30);
  const [sortKey, setSortKey] = useState<ProductSortKey>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { overview, isLoading, error } = useProductSales(period, compare);

  // Поиск → сортировка → срез топ-N. Срез применяется и к экрану, и к выгрузке.
  const rows = useMemo(() => {
    if (!overview) return [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? overview.rows.filter((r) => (r.name ?? r.code ?? '').toLowerCase().includes(q))
      : overview.rows;
    const dir = sortDir === 'asc' ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'name') {
        return (a.name ?? a.code ?? '').localeCompare(b.name ?? b.code ?? '', 'ru') * dir;
      }
      return (sortNum(a, sortKey) - sortNum(b, sortKey)) * dir;
    });
    return topN === 'all' ? sorted : sorted.slice(0, topN);
  }, [overview, search, sortKey, sortDir, topN]);

  function toggleSort(key: ProductSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }

  function handleExport() {
    const showDelta = !!overview?.hasPrev;
    // Изменение выручки: рост зелёным, падение красным.
    const deltaColor = (v: CellValue): AccentColor | undefined =>
      typeof v === 'number' ? (v > 0 ? 'green' : v < 0 ? 'red' : undefined) : undefined;
    const columns: ReportColumn[] = [
      { header: t('psales.col.product'), type: 'text' },
      { header: t('psales.col.code'), type: 'text' },
      { header: t('psales.col.qty'), type: 'int' },
      { header: t('psales.col.receipts'), type: 'int' },
      { header: t('psales.col.revenue'), type: 'money' },
      { header: t('psales.col.profit'), type: 'money' },
      { header: t('psales.col.margin'), type: 'percent' },
      { header: t('psales.col.avg_price'), type: 'money' },
      ...(showDelta ? [{ header: t('psales.col.delta'), type: 'percent' as const, color: deltaColor }] : []),
    ];
    void downloadReport({
      filename: `${t('nav.product_sales')}_${periodStamp(period.current)}.xlsx`,
      sheetName: t('nav.product_sales'),
      title: t('nav.product_sales'),
      subtitle: periodLabel(preset, period, t),
      columns,
      rows: rows.map((r) => {
        const base: CellValue[] = [
          r.name ?? r.code ?? '',
          r.code ?? '',
          r.qty,
          r.receipts,
          Math.round(r.revenue),
          Math.round(r.profit),
          Math.round(margin(r.revenue, r.profit) * 10) / 10,
          Math.round(r.avgPrice),
        ];
        if (!showDelta) return base;
        const d = revenueDelta(r);
        return [...base, d == null ? null : Math.round(d * 10) / 10];
      }),
    });
  }

  return (
    <>
      <header className="mb-5 flex flex-col gap-4">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">
            {t('nav.product_sales')}
          </h1>
          <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">
            {t('psales.subtitle')} · {periodLabel(preset, period, t)}
          </p>
        </div>
        <PeriodSwitcher
          preset={preset}
          custom={custom}
          onPresetChange={setPreset}
          onCustomChange={handleCustomChange}
          presets={PSALES_PRESETS}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setCompare((c) => !c)} className={chipClass(compare)}>
            {t('psales.compare')}
          </button>
          <ExcelButton onClick={handleExport} disabled={!overview || rows.length === 0} />
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {t('common.load_error')} {error}
        </div>
      )}

      <section className="overflow-hidden rounded-[14px] border border-[#ecedf0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-[#f1f2f4] px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-[#8a94a0]">{t('psales.top_label')}:</span>
            {TOP_OPTIONS.map((n) => (
              <button key={String(n)} type="button" onClick={() => setTopN(n)} className={chipClass(topN === n)}>
                {n === 'all' ? t('psales.top.all') : n}
              </button>
            ))}
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('products.search_ph')}
              className="w-full max-w-[300px] rounded-[9px] border border-[#e6e8eb] bg-white px-3.5 py-2 text-sm text-[#1a1f25] outline-none transition-colors placeholder:text-[#9aa4b0] focus:border-[#c2c8cf]"
            />
            <div className="text-sm text-[#56616e]">
              {t('products.shown')}{' '}
              <span className="font-semibold tabular-nums text-[#1a1f25]">{rows.length}</span>
              {overview && (
                <span className="text-[#8a94a0]"> {t('products.of')} {overview.totals.products}</span>
              )}
            </div>
          </div>
        </div>

        {/* Итоги периода */}
        {overview && !isLoading && (
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 border-b border-[#f1f2f4] bg-[#fafbfc] px-5 py-3 text-[13px] text-[#56616e]">
            <span>
              {t('psales.sum.products')}:{' '}
              <span className="font-semibold tabular-nums text-[#1a1f25]">{formatInt(overview.totals.products)}</span>
            </span>
            <span>
              {t('psales.sum.revenue')}:{' '}
              <span className="font-semibold tabular-nums text-[#1a1f25]">{formatMoney(overview.totals.revenue)}</span>
            </span>
            <span>
              {t('psales.sum.receipts')}:{' '}
              <span className="font-semibold tabular-nums text-[#1a1f25]">{formatInt(overview.totals.receipts)}</span>
            </span>
          </div>
        )}

        {isLoading || !overview ? (
          <div className="px-5 py-12 text-center text-sm text-[#8a94a0]">{t('common.loading')}</div>
        ) : overview.rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[#8a94a0]">{t('psales.empty')}</div>
        ) : (
          <ProductSalesTable
            rows={rows}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={toggleSort}
            showDelta={overview.hasPrev}
          />
        )}
      </section>
    </>
  );
}
