import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Link } from 'react-router-dom';
import { formatCompact, formatMoney, formatPercent } from '../../lib/format';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n/dictionaries/ru';
import type { ExpensesSummary } from '../../lib/cashiers';

/** Категории расхода из 1С → ключи перевода. Неизвестная — показываем как есть. */
const REASON_KEY: Record<string, TranslationKey> = {
  Зарплата: 'expenses.cat.salary',
  Возврат: 'expenses.cat.return',
  Поставщик: 'expenses.cat.supplier',
};

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

/** Блок «Расходы кассы»: общий расход + по дням (график) + по категориям (доли). */
export function ExpensesBlock({ expenses }: { expenses: ExpensesSummary }) {
  const t = useT();
  const { total, byCategory, byDay } = expenses;
  const tickInterval = byDay.length > 14 ? Math.ceil(byDay.length / 12) : 0;

  return (
    <section className="rounded-[14px] border border-[#ecedf0] bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h2 className="m-0 text-[15px] font-semibold text-[#1a1f25]">{t('expenses.title')}</h2>
          <Link
            to="/finance/expenses"
            className="text-[13px] font-semibold text-[#1f2937] underline-offset-2 hover:underline"
          >
            {t('expenses.details_link')}
          </Link>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-[#8a94a0]">{t('expenses.total')}</div>
          <div className="text-[26px] font-bold leading-[1.1] tabular-nums text-[#1a1f25]">
            {formatMoney(total)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-[15px] lg:grid-cols-[1.8fr_1fr]">
        {/* Расход по дням */}
        <div>
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
        </div>

        {/* Расход по категориям */}
        <div>
          <div className="mb-2 text-[13px] text-[#7a8593]">{t('expenses.by_category')}</div>
          <div className="flex flex-col gap-3">
            {byCategory.map((c) => {
              const share = total > 0 ? (c.amount / total) * 100 : 0;
              const key = REASON_KEY[c.reason];
              return (
                <div key={c.reason}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="text-[#56616e]">{key ? t(key) : c.reason}</span>
                    <span className="tabular-nums">
                      <span className="font-semibold text-[#1a1f25]">{formatMoney(c.amount)}</span>
                      <span className="ml-1.5 text-[#8a94a0]">{formatPercent(share)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#ecedf0]">
                    <div className="h-full bg-[#5b6b7a]" style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mb-0 mt-4 text-[12.5px] text-[#9aa4b0]">{t('expenses.store_note')}</p>
    </section>
  );
}
