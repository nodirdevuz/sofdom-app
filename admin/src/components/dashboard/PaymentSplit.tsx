import { formatMoney, formatPercent } from '../../lib/format';
import { useT } from '../../i18n';

interface PaymentSplitProps {
  cashTotal: number;
  cardTotal: number;
}

/** Виджет «Наличные vs Карта»: доля безнала + пропорциональный бар. */
export function PaymentSplit({ cashTotal, cardTotal }: PaymentSplitProps) {
  const t = useT();
  const total = cashTotal + cardTotal;
  const cardShare = total > 0 ? (cardTotal / total) * 100 : 0;
  const cashShare = total > 0 ? 100 - cardShare : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[29px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums">
          {formatPercent(cardShare)}
        </div>
        <div className="mt-1 text-[13px] text-[#7a8593]">{t('dashboard.payment.card_share')}</div>
      </div>

      {/* Пропорциональный бар: тёмный сегмент — карта, светлый — наличные. */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#ecedf0]">
        <div className="h-full bg-[#1f2937]" style={{ width: `${cardShare}%` }} />
        <div className="h-full bg-[#9aa4b0]" style={{ width: `${cashShare}%` }} />
      </div>

      <div className="flex flex-col gap-2 text-[13px]">
        <LegendRow
          color="#1f2937"
          label={t('dashboard.payment.card')}
          amount={cardTotal}
          share={cardShare}
        />
        <LegendRow
          color="#9aa4b0"
          label={t('dashboard.payment.cash')}
          amount={cashTotal}
          share={cashShare}
        />
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  amount,
  share,
}: {
  color: string;
  label: string;
  amount: number;
  share: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[#56616e]">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="tabular-nums text-[#1a1f25]">
        <span className="font-semibold">{formatMoney(amount)}</span>
        <span className="ml-1.5 text-[#8a94a0]">· {formatPercent(share)}</span>
      </span>
    </div>
  );
}
