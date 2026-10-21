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
import { hourLabel, hourSortValue, type HourBucket } from '../../lib/salesByHour';

interface HourRevenueChartProps {
  /** Профили часов из RPC (порядок неважен — сортируем по рабочему дню). */
  byHour: HourBucket[];
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; payload: { hour: number } }[];
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0];
  return (
    <div className="rounded-[8px] border border-[#ecedf0] bg-white px-3 py-2 text-[12px] shadow-sm">
      <div className="text-[#8a94a0]">{hourLabel(point.payload.hour)}</div>
      <div className="font-semibold text-[#1a1f25]">{formatMoney(point.value)}</div>
    </div>
  );
}

/** Средняя выручка по часам (столбцы), часы в рабочем порядке 5:00→00:00. */
export function HourRevenueChart({ byHour }: HourRevenueChartProps) {
  const data = [...byHour].sort((a, b) => hourSortValue(a.hour) - hourSortValue(b.hour));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke="#eef0f2" />
        <XAxis
          dataKey="hour"
          tickFormatter={hourLabel}
          tick={{ fontSize: 11, fill: '#8a94a0' }}
          tickLine={false}
          axisLine={{ stroke: '#ecedf0' }}
          interval={0}
          angle={-90}
          textAnchor="end"
          height={48}
        />
        <YAxis
          tickFormatter={formatCompact}
          tick={{ fontSize: 11, fill: '#8a94a0' }}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f2f4f6' }} />
        <Bar dataKey="avgRevenue" fill="#1f2937" radius={[4, 4, 0, 0]} maxBarSize={34} />
      </BarChart>
    </ResponsiveContainer>
  );
}
