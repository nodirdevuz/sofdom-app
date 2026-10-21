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

interface RevenueChartProps {
  /** Выручка по дням: [{ d: 'YYYY-MM-DD', revenue }]. Пропуски уже заполнены нулями. */
  data: { d: string; revenue: number }[];
}

/** 'YYYY-MM-DD' → 'DD.MM' для подписей оси X. */
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

/** График выручки по дням (столбцы) на recharts. */
export function RevenueChart({ data }: RevenueChartProps) {
  // Прореживаем подписи оси X, чтобы на 30 днях они не наезжали.
  const tickInterval = data.length > 14 ? Math.ceil(data.length / 12) : 0;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
        <Bar dataKey="revenue" fill="#1f2937" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
