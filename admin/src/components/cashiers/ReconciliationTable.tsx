import { useState } from 'react';
import { formatMoney } from '../../lib/format';
import { useT } from '../../i18n';
import { reconStatus, combineReconStatus, type ReconStatus, type ReconciliationRow } from '../../lib/reconciliation';
import { useSaveReconciliation } from '../../data/useReconciliation';
import { AmountInput } from './AmountInput';

const thBase =
  'px-4 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold whitespace-nowrap';
const tdBase = 'px-4 py-[13px] border-b border-[#f3f4f6] text-sm';
const bandEdge = 'border-l border-[#e7e9ed]';

const STATUS_STYLE: Record<ReconStatus, string> = {
  match: 'bg-[#e7f6ec] text-[#1a8a4a]',
  short: 'bg-[#fbeae8] text-[#c8332b]',
  over: 'bg-[#fef3e0] text-[#b9760f]',
  empty: 'bg-[#f1f2f4] text-[#8a94a0]',
};

type Kind = 'cash' | 'card';
type Money = number | null;

function draftKey(cashier: string, kind: Kind) {
  return `${cashier}:${kind}`;
}

function discrClass(d: Money): string {
  if (d == null) return 'text-[#8a94a0]';
  return d === 0 ? 'text-[#1a8a4a]' : d < 0 ? 'text-[#c8332b]' : 'text-[#b9760f]';
}
function discrText(d: Money): string {
  return d == null ? '—' : `${d > 0 ? '+' : ''}${formatMoney(d)}`;
}

export function ReconciliationTable({ date, rows }: { date: string; rows: ReconciliationRow[] }) {
  const t = useT();
  const save = useSaveReconciliation();
  const [drafts, setDrafts] = useState<Record<string, Money>>({});
  const [savingCashier, setSavingCashier] = useState<string | null>(null);

  const factOf = (r: ReconciliationRow, kind: Kind): Money => {
    const k = draftKey(r.cashier, kind);
    if (k in drafts) return drafts[k];
    return kind === 'cash' ? r.factCash : r.factCard;
  };
  const setFact = (cashier: string, kind: Kind, n: Money) =>
    setDrafts((d) => ({ ...d, [draftKey(cashier, kind)]: n }));

  async function onSave(r: ReconciliationRow) {
    const fCash = factOf(r, 'cash');
    const fCard = factOf(r, 'card');
    if (fCash == null && fCard == null) return;
    setSavingCashier(r.cashier);
    try {
      await save.mutateAsync({ date, cashier: r.cashier, factCash: fCash ?? 0, factCard: fCard ?? 0 });
    } catch {
      window.alert(t('common.error'));
    } finally {
      setSavingCashier(null);
    }
  }

  const sum = (pick: (r: ReconciliationRow) => number) => rows.reduce((a, r) => a + pick(r), 0);
  const sumFact = (kind: Kind) => rows.reduce((a, r) => a + (factOf(r, kind) ?? 0), 0);

  // Колонки одной группы (нал/безнал): оборот, расход, должен, принёс, расхождение.
  function bandCells(r: ReconciliationRow, kind: Kind) {
    const turnover = kind === 'cash' ? r.cashTurnover : r.cardTurnover;
    const expense = kind === 'cash' ? r.cashExpense : r.cardExpense;
    const should = kind === 'cash' ? r.shouldBring : r.shouldCard;
    const fact = factOf(r, kind);
    const discr = fact == null ? null : fact - should;
    return (
      <>
        <td className={`${tdBase} ${bandEdge} text-right tabular-nums whitespace-nowrap text-[#3a4654] font-medium`}>
          {formatMoney(turnover)}
        </td>
        <td className={`${tdBase} text-right tabular-nums whitespace-nowrap text-[#3a4654] font-medium`}>
          {formatMoney(expense)}
        </td>
        <td className={`${tdBase} text-right tabular-nums whitespace-nowrap font-semibold text-[#1a1f25]`}>
          {formatMoney(should)}
        </td>
        <td className={`${tdBase} text-right`}>
          <AmountInput value={fact} onChange={(n) => setFact(r.cashier, kind, n)} className="w-[120px]" />
        </td>
        <td className={`${tdBase} text-right tabular-nums whitespace-nowrap font-semibold ${discrClass(discr)}`}>
          {discrText(discr)}
        </td>
      </>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[14px] border border-[#ecedf0] bg-white">
      <table className="w-full border-collapse min-w-[1320px]">
        <thead>
          <tr>
            <th className={`${thBase} text-left`} rowSpan={2}>
              {t('recon.col.cashier')}
            </th>
            <th className={`${thBase} ${bandEdge} text-center`} colSpan={5}>
              {t('recon.group.cash')}
            </th>
            <th className={`${thBase} ${bandEdge} text-center`} colSpan={5}>
              {t('recon.group.card')}
            </th>
            <th className={`${thBase} ${bandEdge} text-center`} rowSpan={2}>
              {t('recon.col.status')}
            </th>
            <th className={`${thBase} text-right`} rowSpan={2} />
          </tr>
          <tr>
            <th className={`${thBase} ${bandEdge} text-right`}>{t('recon.col.turnover')}</th>
            <th className={`${thBase} text-right`}>{t('recon.col.expense')}</th>
            <th className={`${thBase} text-right`}>{t('recon.col.should')}</th>
            <th className={`${thBase} text-right`}>{t('recon.col.fact')}</th>
            <th className={`${thBase} text-right`}>{t('recon.col.discrepancy')}</th>
            <th className={`${thBase} ${bandEdge} text-right`}>{t('recon.col.turnover')}</th>
            <th className={`${thBase} text-right`}>{t('recon.col.expense')}</th>
            <th className={`${thBase} text-right`}>{t('recon.col.should')}</th>
            <th className={`${thBase} text-right`}>{t('recon.col.fact')}</th>
            <th className={`${thBase} text-right`}>{t('recon.col.discrepancy')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const status = combineReconStatus(
              reconStatus(r.shouldBring, factOf(r, 'cash')),
              reconStatus(r.shouldCard, factOf(r, 'card')),
            );
            return (
              <tr key={r.cashier} className="transition-colors hover:bg-[#fafbfc]">
                <td className={`${tdBase} text-left font-semibold text-[#1a1f25] whitespace-nowrap`}>{r.cashier}</td>
                {bandCells(r, 'cash')}
                {bandCells(r, 'card')}
                <td className={`${tdBase} ${bandEdge} text-center`}>
                  <span className={`inline-block rounded-[7px] px-2.5 py-1 text-[12px] font-semibold ${STATUS_STYLE[status]}`}>
                    {t(`recon.status.${status}`)}
                  </span>
                </td>
                <td className={`${tdBase} text-right`}>
                  <button
                    className="rounded-[8px] bg-[#1a1f25] px-3.5 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    disabled={(factOf(r, 'cash') == null && factOf(r, 'card') == null) || savingCashier === r.cashier}
                    onClick={() => void onSave(r)}
                  >
                    {savingCashier === r.cashier ? '…' : t('common.save')}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="bg-[#fafbfc]">
              <td className={`${tdBase} text-left font-bold text-[#1a1f25] border-t border-[#eceef0]`}>{t('recon.total')}</td>
              {(['cash', 'card'] as const).map((kind) => {
                const totFact = sumFact(kind);
                const totShould = sum((r) => (kind === 'cash' ? r.shouldBring : r.shouldCard));
                const totDiscr = totFact - totShould;
                return (
                  <FootBand
                    key={kind}
                    turnover={sum((r) => (kind === 'cash' ? r.cashTurnover : r.cardTurnover))}
                    expense={sum((r) => (kind === 'cash' ? r.cashExpense : r.cardExpense))}
                    should={totShould}
                    fact={totFact}
                    discr={totDiscr}
                  />
                );
              })}
              <td className={`${tdBase} ${bandEdge} border-t border-[#eceef0]`} colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function FootBand({
  turnover,
  expense,
  should,
  fact,
  discr,
}: {
  turnover: number;
  expense: number;
  should: number;
  fact: number;
  discr: number;
}) {
  const footTd = `${tdBase} text-right tabular-nums font-bold text-[#1a1f25] border-t border-[#eceef0]`;
  return (
    <>
      <td className={`${footTd} ${bandEdge}`}>{formatMoney(turnover)}</td>
      <td className={footTd}>{formatMoney(expense)}</td>
      <td className={footTd}>{formatMoney(should)}</td>
      <td className={footTd}>{formatMoney(fact)}</td>
      <td className={`${tdBase} text-right tabular-nums font-bold border-t border-[#eceef0] ${discrClass(discr)}`}>
        {discrText(discr)}
      </td>
    </>
  );
}
