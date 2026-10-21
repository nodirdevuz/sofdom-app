import { useState } from 'react';
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
import type { CashflowByDay } from '../../lib/cashflow';

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

/** Маленькая метрика-плитка (средний/лучший/худший день). */
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[10px] bg-[#f7f8f9] px-3.5 py-2.5">
      <div className="text-[12px] text-[#8a94a0]">{label}</div>
      <div className="text-[15px] font-semibold tabular-nums text-[#1a1f25]">{value}</div>
      {sub && <div className="text-[11px] text-[#9aa4b0]">{sub}</div>}
    </div>
  );
}

/** «Доход по дням»: общий доход крупно + столбцы дохода + средний/лучший/худший +
 *  нетто-таблица доход/расход/разница (взгляд — и видно, сколько заработали). */
export function IncomeByDay({ data }: { data: CashflowByDay }) {
  const t = useT();
  const [showTable, setShowTable] = useState(false);
  const { incomeTotal, diffTotal, avgIncome, best, worst, days } = data;
  const tickInterval = days.length > 14 ? Math.ceil(days.length / 12) : 0;
  const tableDays = [...days].reverse(); // новые сверху

  return (
    <section className="rounded-[14px] border border-[#ecedf0] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[15px] font-semibold text-[#1a1f25]">{t('income.title')}</h2>
          <p className="mb-0 mt-0.5 text-[12.5px] text-[#9aa4b0]">{t('income.subtitle')}</p>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-[#8a94a0]">{t('income.total')}</div>
          <div className="text-[28px] font-bold leading-[1.1] tabular-nums text-[#1b7a3d]">
            {formatMoney(incomeTotal)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t('income.avg')} value={formatMoney(avgIncome)} />
        <Stat
          label={t('income.best')}
          value={best ? formatMoney(best.income) : '—'}
          sub={best ? shortDate(best.d) : undefined}
        />
        <Stat
          label={t('income.worst')}
          value={worst ? formatMoney(worst.income) : '—'}
          sub={worst ? shortDate(worst.d) : undefined}
        />
        <Stat label={t('income.diff_total')} value={formatMoney(diffTotal)} sub={t('income.diff_hint')} />
      </div>

      <div className="mt-4">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#eef6f0' }} />
            <Bar dataKey="income" fill="#1b7a3d" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <button
        type="button"
        onClick={() => setShowTable((v) => !v)}
        className="mt-3 text-[13px] font-semibold text-[#1f2937] underline-offset-2 hover:underline"
      >
        {showTable ? t('income.hide_table') : t('income.show_table')}
      </button>

      {showTable && (
        <div className="mt-3 max-h-[360px] overflow-auto rounded-[12px] border border-[#ecedf0]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-[#fafbfc]">
              <tr>
                {[t('income.col.date'), t('income.col.income'), t('income.col.expense'), t('income.col.diff')].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`border-b border-[#eceef0] px-4 py-[10px] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] ${
                        i === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {tableDays.map((row) => (
                <tr key={row.d} className="hover:bg-[#fafbfc]">
                  <td className="border-b border-[#f3f4f6] px-4 py-[10px] text-sm tabular-nums">{row.d}</td>
                  <td className="border-b border-[#f3f4f6] px-4 py-[10px] text-right text-sm tabular-nums text-[#1b7a3d]">
                    {formatMoney(row.income)}
                  </td>
                  <td className="border-b border-[#f3f4f6] px-4 py-[10px] text-right text-sm tabular-nums text-[#c8332b]">
                    {formatMoney(row.expense)}
                  </td>
                  <td
                    className={`border-b border-[#f3f4f6] px-4 py-[10px] text-right text-sm font-semibold tabular-nums ${
                      row.diff >= 0 ? 'text-[#1b7a3d]' : 'text-[#c8332b]'
                    }`}
                  >
                    {formatMoney(row.diff)}
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
