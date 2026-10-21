import type { ReactNode } from 'react';
import { formatDecimal, formatInt, formatMoney, formatPercent } from '../../lib/format';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n/dictionaries/ru';
import { margin, revenueDelta, type ProductSalesRow, type ProductSortKey } from '../../lib/productSales';

interface ColumnDef {
  key: ProductSortKey | 'code' | 'delta';
  labelKey: TranslationKey;
  align: 'left' | 'right';
  sortable: boolean;
  render: (r: ProductSalesRow) => ReactNode;
}

const th =
  'px-4 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold whitespace-nowrap';
const td = 'px-4 py-[12px] border-b border-[#f3f4f6] text-sm';
const tdNum = `${td} text-right tabular-nums whitespace-nowrap text-[#3a4654] font-medium`;

function DeltaCell({ row }: { row: ProductSalesRow }) {
  const d = revenueDelta(row);
  if (d == null) return <span className="text-[#b3bcc6]">—</span>;
  const up = d >= 0;
  return (
    <span className="font-semibold" style={{ color: up ? '#1b7a3d' : '#c8332b' }}>
      {up ? '↑' : '↓'} {formatPercent(Math.abs(d))}
    </span>
  );
}

const BASE_COLUMNS: ColumnDef[] = [
  { key: 'code', labelKey: 'psales.col.code', align: 'left', sortable: false, render: (r) => r.code ?? '—' },
  { key: 'qty', labelKey: 'psales.col.qty', align: 'right', sortable: true, render: (r) => formatDecimal(r.qty) },
  { key: 'receipts', labelKey: 'psales.col.receipts', align: 'right', sortable: true, render: (r) => formatInt(r.receipts) },
  { key: 'revenue', labelKey: 'psales.col.revenue', align: 'right', sortable: true, render: (r) => formatMoney(r.revenue) },
  { key: 'profit', labelKey: 'psales.col.profit', align: 'right', sortable: true, render: (r) => formatMoney(r.profit) },
  { key: 'margin', labelKey: 'psales.col.margin', align: 'right', sortable: true, render: (r) => formatPercent(margin(r.revenue, r.profit)) },
  { key: 'avgPrice', labelKey: 'psales.col.avg_price', align: 'right', sortable: true, render: (r) => formatMoney(r.avgPrice) },
];

const DELTA_COLUMN: ColumnDef = {
  key: 'delta',
  labelKey: 'psales.col.delta',
  align: 'right',
  sortable: false,
  render: (r) => <DeltaCell row={r} />,
};

interface ProductSalesTableProps {
  rows: ProductSalesRow[];
  sortKey: ProductSortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: ProductSortKey) => void;
  showDelta: boolean;
}

/** Сортируемая таблица проданных товаров (rows — уже отфильтрованы/отсортированы/срезаны). */
export function ProductSalesTable({ rows, sortKey, sortDir, onSort, showDelta }: ProductSalesTableProps) {
  const t = useT();
  const columns = showDelta ? [...BASE_COLUMNS, DELTA_COLUMN] : BASE_COLUMNS;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr>
            <th className={`${th} text-left`}>{t('psales.col.product')}</th>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable ? () => onSort(col.key as ProductSortKey) : undefined}
                className={`${th} ${col.align === 'right' ? 'text-right' : 'text-left'} ${
                  col.sortable ? 'cursor-pointer select-none transition-colors hover:text-[#5b6b7a]' : ''
                }`}
              >
                {t(col.labelKey)}
                {col.sortable && sortKey === col.key && (
                  <span className="ml-1 text-[#5b6b7a]">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.product_id} className="transition-colors hover:bg-[#fafbfc]">
              <td className={`${td} text-left font-semibold text-[#1a1f25]`}>{r.name ?? r.code ?? '—'}</td>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={col.align === 'right' ? tdNum : `${td} text-left text-[#56616e]`}
                >
                  {col.render(r)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="px-5 py-12 text-center text-sm text-[#8a94a0]">
                {t('common.not_found')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
