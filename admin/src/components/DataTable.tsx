import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  /** Содержимое ячейки. */
  render: (row: T) => ReactNode;
  /** Доп. классы ячейки (цвет/жирность текста). */
  cellClassName?: string;
}

interface DataTableProps<T> {
  title: string;
  count: number;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Клик по строке (курсор становится pointer). */
  onRowClick?: (row: T) => void;
  /** Доп. классы строки (например подсветка долга). */
  rowClassName?: (row: T) => string;
  /** Ниже breakpoint md строки выводятся карточками вместо таблицы (первая колонка — заголовок). */
  mobileCards?: boolean;
  /** Итоговая строка: по одной ячейке на колонку. */
  footerCells?: ReactNode[];
}

/** Переиспользуемая таблица в карточке — вёрстка из исходного дизайна. */
export function DataTable<T>({ title, count, columns, rows, rowKey, onRowClick, rowClassName, mobileCards, footerCells }: DataTableProps<T>) {
  const [titleCol, ...detailCols] = columns;
  return (
    <div className="mt-[26px] border border-[#ecedf0] rounded-[14px] overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-b border-[#f1f2f4]">
        <div className="text-base font-semibold">{title}</div>
        <div className="text-[12.5px] text-[#8a94a0] font-medium bg-[#f3f4f6] px-2.5 py-[3px] rounded-full">
          {count}
        </div>
      </div>
      <div className={`overflow-x-auto ${mobileCards ? 'hidden md:block' : ''}`}>
        <table className="w-full border-collapse min-w-[660px]">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition-colors hover:bg-[#fafbfc] ${onRowClick ? 'cursor-pointer' : ''} ${rowClassName?.(row) ?? ''}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-5 py-[13px] border-b border-[#f3f4f6] text-sm tabular-nums whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    } ${col.cellClassName ?? ''}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footerCells && (
            <tfoot>
              <tr className="bg-[#fafbfc] font-semibold">
                {columns.map((col, index) => (
                  <td
                    key={col.key}
                    className={`px-5 py-[13px] text-sm tabular-nums whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {footerCells[index]}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {mobileCards && (
        <ul className="m-0 list-none p-0 md:hidden">
          {rows.map((row) => (
            <li
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-[#f3f4f6] px-5 py-[13px] last:border-b-0 ${
                onRowClick ? 'cursor-pointer active:bg-[#fafbfc]' : ''
              } ${rowClassName?.(row) ?? ''}`}
            >
              <div className="text-sm font-semibold">{titleCol.render(row)}</div>
              <dl className="m-0 mt-2 flex flex-col gap-[7px]">
                {detailCols.map((col) => (
                  <div key={col.key} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#94a0ac]">
                      {col.label}
                    </dt>
                    <dd className={`m-0 min-w-0 text-right text-sm tabular-nums ${col.cellClassName ?? ''}`}>
                      {col.render(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
          {footerCells && (
            <li className="bg-[#fafbfc] px-5 py-[13px] font-semibold">
              <div className="text-sm">{footerCells[0]}</div>
              <dl className="m-0 mt-2 flex flex-col gap-[7px]">
                {detailCols.map((col, index) => (
                  <div key={col.key} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#94a0ac]">
                      {col.label}
                    </dt>
                    <dd className="m-0 min-w-0 text-right text-sm tabular-nums">{footerCells[index + 1]}</dd>
                  </div>
                ))}
              </dl>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
