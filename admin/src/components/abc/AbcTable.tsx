import { formatMoney, formatPercent } from '../../lib/format';
import { useT } from '../../i18n';
import { clampPct, margin, type AbcRow } from '../../lib/abc';
import { AbcBadge } from './AbcBadge';

const th =
  'px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold whitespace-nowrap';
const td = 'px-5 py-[13px] border-b border-[#f3f4f6] text-sm';
const tdNum = `${td} text-right tabular-nums whitespace-nowrap text-[#3a4654] font-medium`;

/** Рейтинг товаров с долей, накопительным % и группой A/B/C. rows — уже отфильтрованы. */
export function AbcTable({ rows }: { rows: AbcRow[] }) {
  const t = useT();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr>
            <th className={`${th} text-left`}>{t('abc.col.product')}</th>
            <th className={`${th} text-right`}>{t('abc.col.revenue')}</th>
            <th className={`${th} text-right`}>{t('abc.col.profit')}</th>
            <th className={`${th} text-right`}>{t('abc.col.margin')}</th>
            <th className={`${th} text-right`}>{t('abc.col.share')}</th>
            <th className={`${th} text-right`}>{t('abc.col.cumulative')}</th>
            <th className={`${th} text-center`}>{t('abc.col.group')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.product_id} className="transition-colors hover:bg-[#fafbfc]">
              <td className={`${td} text-left font-semibold text-[#1a1f25]`}>
                {r.name ?? r.code ?? '—'}
              </td>
              <td className={tdNum}>{formatMoney(r.revenue)}</td>
              <td className={tdNum}>{formatMoney(r.profit)}</td>
              <td className={tdNum}>{formatPercent(margin(r.revenue, r.profit))}</td>
              <td className={tdNum}>{formatPercent(r.share)}</td>
              <td className={tdNum}>{formatPercent(clampPct(r.cumulative))}</td>
              <td className={`${td} text-center`}>
                <AbcBadge group={r.group} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-12 text-center text-sm text-[#8a94a0]">
                {t('common.not_found')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
