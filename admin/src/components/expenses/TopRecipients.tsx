import { formatMoney } from '../../lib/format';
import { useT } from '../../i18n';
import { share, type ExpenseRecipient } from '../../lib/expenses';

/** Топ получателей по нормализованному note (сумма, кол-во, бейдж долга). */
export function TopRecipients({ items }: { items: ExpenseRecipient[] }) {
  const t = useT();
  const max = items.reduce((m, r) => Math.max(m, r.amount), 0);

  return (
    <section className="rounded-[14px] border border-[#ecedf0] bg-white p-5">
      <h2 className="m-0 mb-3 text-[15px] font-semibold text-[#1a1f25]">
        {t('expenses.recipients.title')}
      </h2>
      {items.length === 0 ? (
        <p className="m-0 text-[13px] text-[#8a94a0]">{t('expenses.recipients.empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((r) => (
            <div key={r.noteSample}>
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="flex min-w-0 items-center gap-1.5 text-[#56616e]">
                  <span className="truncate">{r.noteSample}</span>
                  {r.isDebt && (
                    <span className="shrink-0 rounded-full bg-[#fbeae8] px-1.5 py-[1px] text-[11px] font-semibold text-[#c8332b]">
                      {t('expenses.badge.debt')}
                    </span>
                  )}
                  <span className="shrink-0 text-[#9aa4b0]">
                    {t('expenses.count_suffix', { count: r.count })}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-[#1a1f25]">
                  {formatMoney(r.amount)}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#ecedf0]">
                <div
                  className={r.isDebt ? 'h-full bg-[#c8332b]' : 'h-full bg-[#5b6b7a]'}
                  style={{ width: `${share(r.amount, max)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
