import { useEffect, useState } from 'react';
import { DataTable, type Column } from '../components/DataTable';
import { Skeleton } from '../components/Skeleton';
import { useT } from '../i18n';
import { formatDate, formatInt } from '../lib/format';
import { useScanNotFound } from '../data/useScanNotFound';
import type { ScanNotFoundRow } from '../lib/scanNotFound';

const controlClass =
  'px-[11px] py-[7px] rounded-[9px] border border-[#e6e8eb] text-[13px] text-[#1a1f25] bg-white focus:outline-none focus:border-[#1f2937]';

/**
 * «13.09.2026, 16:19» — дата и время последнего скана.
 *
 * База отдаёт timestamptz в UTC, а магазин живёт в Ташкенте: резать строку
 * нельзя, иначе вечерний скан показывается утренним (на +5 это ровно так и
 * выглядело — 16:19 превращались в 11:19). Поэтому переводим по-настоящему.
 */
const TZ = 'Asia/Tashkent';
const whenFormat = new Intl.DateTimeFormat('ru-RU', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function whenLabel(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? formatDate(iso) : whenFormat.format(d);
}

/**
 * «Не найдено»: какие штрихкоды сканируют в приёмке и не находят.
 *
 * Страница намеренно простая и только читает. Ничего «завести» отсюда нельзя:
 * прав на создание номенклатуры в 1С у нас нет. Смысл списка — показать
 * владельцу, чего не хватает в базе, чтобы он завёл это сам в 1С.
 */
export default function ScanNotFound() {
  const t = useT();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Не дёргаем базу на каждую цифру.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query = useScanNotFound(search);
  const data = query.data;
  const rows = data?.rows ?? [];

  const columns: Column<ScanNotFoundRow>[] = [
    {
      key: 'barcode',
      label: t('snf.col.barcode'),
      render: (r) => <span className="font-mono tabular-nums">{r.barcode}</span>,
    },
    {
      key: 'times',
      label: t('snf.col.times'),
      align: 'right',
      render: (r) => formatInt(r.times),
    },
    { key: 'last', label: t('snf.col.last'), render: (r) => whenLabel(r.lastAt) },
    { key: 'who', label: t('snf.col.who'), render: (r) => r.who || '—' },
  ];

  return (
    <div className="px-4 py-5 sm:px-6">
      <h1 className="m-0 text-[22px] font-semibold">{t('snf.title')}</h1>
      <p className="m-0 mt-1 text-[13px] text-[#56616e]">{t('snf.subtitle')}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <input
          className={`${controlClass} min-w-[220px] flex-1`}
          placeholder={t('snf.search')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {data && (
          <span className="text-[13px] text-[#56616e]">
            {t('snf.summary')}: <b>{formatInt(data.total)}</b> · {t('snf.summary_scans')}:{' '}
            <b>{formatInt(data.events)}</b>
          </span>
        )}
      </div>

      <div className="mt-4">
        {query.isLoading && !data ? (
          <Skeleton />
        ) : query.isError ? (
          <p className="text-[13px] text-[#b42318]">
            {t('snf.error')}: {(query.error as Error).message}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-[#56616e]">{t('snf.empty')}</p>
        ) : (
          <DataTable
            title={t('snf.table_title')}
            count={rows.length}
            columns={columns}
            rows={rows}
            rowKey={(r) => r.barcode}
            mobileCards
          />
        )}
      </div>
    </div>
  );
}
