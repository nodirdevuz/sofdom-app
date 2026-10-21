import { formatDecimal, formatInt, formatMoney } from '../../lib/format';
import { useT } from '../../i18n';
import type { DeadProduct } from '../../lib/inventory';
import { common } from './tableStyles';

interface DeadStockTableProps {
  rows: DeadProduct[];
}

/** Правая половина: мёртвый сток (остаток есть, продаж нет), по замороженной сумме. */
export function DeadStockTable({ rows }: DeadStockTableProps) {
  const t = useT();

  return (
    <section className="overflow-hidden rounded-[14px] border border-[#ecedf0] bg-white">
      <div className="border-b border-[#f1f2f4] px-5 py-4">
        <div className="text-base font-semibold text-[#1a1f25]">{t('inventory.dead.title')}</div>
        <div className="mt-0.5 text-[12.5px] text-[#8a94a0]">{t('inventory.dead.subtitle')}</div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-[#8a94a0]">{t('inventory.empty')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr>
                <th className={`${common.th} text-left`}>{t('inventory.col.product')}</th>
                <th className={`${common.th} text-right`}>{t('inventory.col.stock')}</th>
                <th className={`${common.th} text-right`}>{t('inventory.col.days')}</th>
                <th className={`${common.th} text-right`}>{t('inventory.col.frozen')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product_id} className="transition-colors hover:bg-[#fafbfc]">
                  <td className={`${common.td} text-left font-semibold text-[#1a1f25]`}>
                    {r.name ?? r.code ?? '—'}
                  </td>
                  <td className={common.tdNum}>{formatDecimal(r.stock)}</td>
                  <td className={common.tdNum}>
                    {r.days_no_sale == null ? t('inventory.never_sold') : formatInt(r.days_no_sale)}
                  </td>
                  <td className={`${common.tdNum} font-semibold text-[#1a1f25]`}>
                    {formatMoney(r.frozen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
