import { useState } from 'react';
import { KPICard } from '../components/KPICard';
import { Skeleton } from '../components/Skeleton';
import { PeriodSwitcher } from '../components/dashboard/PeriodSwitcher';
import { HourHeatmap } from '../components/hours/HourHeatmap';
import { HourRevenueChart } from '../components/hours/HourRevenueChart';
import { useSalesByHour } from '../data/useSalesByHour';
import { usePeriod } from '../hooks/usePeriod';
import { useT } from '../i18n';
import { formatMoney } from '../lib/format';
import { periodLabel, type PeriodPreset } from '../lib/period';
import { dowFullKey, hourLabel, type HourMetric } from '../lib/salesByHour';
import type { Kpi } from '../types';

const HOUR_PRESETS: PeriodPreset[] = ['last30', 'last60', 'last90', 'custom'];
const METRICS: HourMetric[] = ['revenue', 'receipts'];

function chipClass(active: boolean): string {
  return [
    'px-[14px] py-[7px] rounded-[9px] text-[13px] font-semibold whitespace-nowrap transition-colors border',
    active
      ? 'bg-[#1f2937] text-white border-[#1f2937]'
      : 'bg-white text-[#56616e] border-[#e6e8eb] hover:bg-[#f7f8f9]',
  ].join(' ');
}

export default function SalesByHour() {
  const t = useT();
  const { preset, custom, period, setPreset, handleCustomChange } = usePeriod('last30');
  const [metric, setMetric] = useState<HourMetric>('revenue');
  const { overview, isLoading, error } = useSalesByHour(period);

  const kpi = overview?.kpi;
  const dowKey = dowFullKey(kpi?.bestDow ?? null);
  const kpis: Kpi[] = kpi
    ? [
        {
          value: kpi.bestHour == null ? '—' : hourLabel(kpi.bestHour),
          label: `${t('hours.kpi.best_hour')} · ${formatMoney(kpi.bestHourProfit)}`,
        },
        {
          value: dowKey ? t(dowKey) : '—',
          label: `${t('hours.kpi.best_dow')} · ${formatMoney(kpi.bestDowProfit)}`,
        },
        { value: formatMoney(kpi.avgHourRevenue), label: t('hours.kpi.avg_hour') },
      ]
    : [];

  const isEmpty = !!overview && overview.byHour.length === 0;

  return (
    <>
      <header className="mb-5 flex flex-col gap-4">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">{t('nav.hours')}</h1>
          <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">
            {t('hours.subtitle')} · {periodLabel(preset, period, t)}
          </p>
        </div>
        <PeriodSwitcher
          preset={preset}
          custom={custom}
          onPresetChange={setPreset}
          onCustomChange={handleCustomChange}
          presets={HOUR_PRESETS}
        />
      </header>

      {error && (
        <div className="mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {t('common.load_error')} {error}
        </div>
      )}

      {/* KPI: лучший час · лучший день · средняя выручка в час */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(218px,1fr))] gap-[15px]">
        {isLoading || !overview
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)
          : kpis.map((k) => <KPICard key={k.label} kpi={k} />)}
      </div>

      {isEmpty ? (
        <div className="mt-[22px] rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
          {t('hours.empty')}
        </div>
      ) : (
        <div className="mt-[22px] grid grid-cols-1 gap-[15px] lg:grid-cols-2">
          {/* Тепловая карта час × день недели */}
          <section className="overflow-hidden rounded-[14px] border border-[#ecedf0] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f2f4] px-5 py-4">
              <div>
                <div className="text-base font-semibold text-[#1a1f25]">{t('hours.heatmap.title')}</div>
                <div className="mt-0.5 text-[12.5px] text-[#8a94a0]">{t('hours.heatmap.subtitle')}</div>
              </div>
              <div className="flex items-center gap-2">
                {METRICS.map((m) => (
                  <button key={m} type="button" onClick={() => setMetric(m)} className={chipClass(metric === m)}>
                    {t(m === 'revenue' ? 'hours.metric.revenue' : 'hours.metric.receipts')}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-5">
              {isLoading || !overview ? (
                <Skeleton className="h-[420px]" />
              ) : (
                <HourHeatmap overview={overview} metric={metric} />
              )}
            </div>
          </section>

          {/* Средняя выручка по часам */}
          <section className="overflow-hidden rounded-[14px] border border-[#ecedf0] bg-white">
            <div className="border-b border-[#f1f2f4] px-5 py-4">
              <div className="text-base font-semibold text-[#1a1f25]">{t('hours.chart.title')}</div>
              <div className="mt-0.5 text-[12.5px] text-[#8a94a0]">{t('hours.chart.subtitle')}</div>
            </div>
            <div className="p-5">
              {isLoading || !overview ? (
                <Skeleton className="h-[280px]" />
              ) : (
                <HourRevenueChart byHour={overview.byHour} />
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
