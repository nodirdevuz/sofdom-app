import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompact, formatMoney } from '../../lib/format';
import { useT } from '../../i18n';

function shortDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${day}.${m}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: { d: string } }[];
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0];
  return (
    <div className="rounded-[8px] border border-[#ecedf0] bg-white px-3 py-2 text-[12px] shadow-sm">
      <div className="text-[#8a94a0]">{shortDate(point.payload.d)}</div>
      <div className="font-semibold text-[#1a1f25]">{formatMoney(point.value)}</div>
    </div>
  );
}

/** Расход по дням за период (источник — overview.byDay). */
export function ExpensesDayChart({ byDay }: { byDay: { d: string; amount: number }[] }) {
  const t = useT();
  const tickInterval = byDay.length > 14 ? Math.ceil(byDay.length / 12) : 0;
  return (
    <section className="rounded-[14px] border border-[#ecedf0] bg-white p-5">
      <div className="mb-2 text-[13px] text-[#7a8593]">{t('expenses.by_day')}</div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={byDay} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="#eef0f2" />
          <XAxis
            dataKey="d"
            tickFormatter={shortDate}
            interval={tickInterval}
            tick={{ fontSize: 11, fill: '#8a94a0' }}
            tickLine={false}
            axisLine={{ stroke: '#ecedf0' }}
          />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fontSize: 11, fill: '#8a94a0' }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f2f4f6' }} />
          <Bar dataKey="amount" fill="#5b6b7a" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
