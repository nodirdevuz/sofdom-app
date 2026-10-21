import { formatDecimal, formatMoney, formatPercent } from '../../lib/format';
import { useT } from '../../i18n';
import { margin, type TopProduct } from '../../lib/inventory';
import { common } from './tableStyles';

interface TopProductsTableProps {
  rows: TopProduct[];
}

/** Левая половина: топ-20 товаров по выручке (что продаётся, группа A). */
export function TopProductsTable({ rows }: TopProductsTableProps) {
  const t = useT();

  return (
    <section className="overflow-hidden rounded-[14px] border border-[#ecedf0] bg-white">
      <div className="border-b border-[#f1f2f4] px-5 py-4">
        <div className="text-base font-semibold text-[#1a1f25]">{t('inventory.top.title')}</div>
        <div className="mt-0.5 text-[12.5px] text-[#8a94a0]">{t('inventory.top.subtitle')}</div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-[#8a94a0]">{t('inventory.empty')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr>
                <th className={`${common.th} text-left`}>{t('inventory.col.product')}</th>
                <th className={`${common.th} text-right`}>{t('inventory.col.sold')}</th>
                <th className={`${common.th} text-right`}>{t('inventory.col.revenue')}</th>
                <th className={`${common.th} text-right`}>{t('inventory.col.profit')}</th>
                <th className={`${common.th} text-right`}>{t('inventory.col.margin')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product_id} className="transition-colors hover:bg-[#fafbfc]">
                  <td className={`${common.td} text-left font-semibold text-[#1a1f25]`}>
                    {r.name ?? r.code ?? '—'}
                  </td>
                  <td className={common.tdNum}>{formatDecimal(r.qty)}</td>
                  <td className={common.tdNum}>{formatMoney(r.revenue)}</td>
                  <td className={common.tdNum}>{formatMoney(r.profit)}</td>
                  <td className={common.tdNum}>{formatPercent(margin(r.revenue, r.profit))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
