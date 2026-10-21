import { useMemo, useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { PeriodSwitcher } from '../components/dashboard/PeriodSwitcher';
import { AbcKpiCards } from '../components/abc/AbcKpiCards';
import { AbcTable } from '../components/abc/AbcTable';
import { useAbc } from '../data/useAbc';
import { usePeriod } from '../hooks/usePeriod';
import { ExcelButton } from '../components/ExcelButton';
import { useT } from '../i18n';
import { periodStamp } from '../lib/xlsx';
import { downloadReport } from '../lib/excelReport';
import { periodLabel, type PeriodPreset } from '../lib/period';
import { ABC_GROUPS, clampPct, margin, type AbcGroup, type AbcMetric } from '../lib/abc';

// ABC меряют вклад за период — те же аналитические окна, что и «Деньги на полках».
const ABC_PRESETS: PeriodPreset[] = ['last30', 'last60', 'last90', 'custom'];
const METRICS: AbcMetric[] = ['profit', 'revenue'];
type GroupFilter = 'all' | AbcGroup;

function chipClass(active: boolean): string {
  return [
    'px-[14px] py-[7px] rounded-[9px] text-[13px] font-semibold whitespace-nowrap transition-colors border',
    active
      ? 'bg-[#1f2937] text-white border-[#1f2937]'
      : 'bg-white text-[#56616e] border-[#e6e8eb] hover:bg-[#f7f8f9]',
  ].join(' ');
}

export default function AbcAnalysis() {
  const t = useT();
  const { preset, custom, period, setPreset, handleCustomChange } = usePeriod('last30');
  const [metric, setMetric] = useState<AbcMetric>('profit');
  const [group, setGroup] = useState<GroupFilter>('all');
  const [search, setSearch] = useState('');
  const { overview, isLoading, error } = useAbc(period, metric);

  // Фильтр по группе + поиск по названию. Сортировка приходит из RPC (по метрике).
  const rows = useMemo(() => {
    if (!overview) return [];
    const q = search.trim().toLowerCase();
    return overview.rows.filter((r) => {
      if (group !== 'all' && r.group !== group) return false;
      if (q && !(r.name ?? r.code ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [overview, group, search]);

  // Экспорт текущего среза (с учётом фильтра и поиска). Числа — числами для Excel.
  function handleExport() {
    void downloadReport({
      filename: `${t('nav.abc')}_${periodStamp(period.current)}.xlsx`,
      sheetName: t('nav.abc'),
      title: t('nav.abc'),
      subtitle: periodLabel(preset, period, t),
      columns: [
        { header: t('abc.col.product'), type: 'text' },
        { header: t('abc.col.revenue'), type: 'money' },
        { header: t('abc.col.profit'), type: 'money' },
        { header: t('abc.col.margin'), type: 'percent' },
        { header: t('abc.col.share'), type: 'percent' },
        { header: t('abc.col.cumulative'), type: 'percent' },
        { header: t('abc.col.group'), type: 'text' },
      ],
      rows: rows.map((r) => [
        r.name ?? r.code ?? '',
        Math.round(r.revenue),
        Math.round(r.profit),
        Math.round(margin(r.revenue, r.profit) * 10) / 10,
        Math.round(r.share * 100) / 100,
        Math.round(clampPct(r.cumulative) * 100) / 100,
        r.group,
      ]),
    });
  }

  return (
    <>
      <header className="mb-5 flex flex-col gap-4">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">{t('nav.abc')}</h1>
          <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">
            {t('abc.subtitle')} · {periodLabel(preset, period, t)}
          </p>
        </div>
        <PeriodSwitcher
          preset={preset}
          custom={custom}
          onPresetChange={setPreset}
          onCustomChange={handleCustomChange}
          presets={ABC_PRESETS}
        />
        {/* Метрика классификации (слева) + экспорт (справа). */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[#8a94a0]">{t('abc.metric_label')}</span>
            {METRICS.map((m) => (
              <button key={m} type="button" onClick={() => setMetric(m)} className={chipClass(metric === m)}>
                {t(m === 'profit' ? 'abc.metric.profit' : 'abc.metric.revenue')}
              </button>
            ))}
          </div>
          <ExcelButton onClick={handleExport} disabled={!overview || rows.length === 0} />
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {t('common.load_error')} {error}
        </div>
      )}

      {/* KPI: группы A/B/C — сколько товаров и какой % метрики. */}
      {isLoading || !overview ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(218px,1fr))] gap-[15px]">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[116px]" />
          ))}
        </div>
      ) : (
        <AbcKpiCards overview={overview} />
      )}

      {/* Таблица: фильтр по группе + поиск + рейтинг товаров. */}
      <section className="mt-[22px] overflow-hidden rounded-[14px] border border-[#ecedf0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-[#f1f2f4] px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setGroup('all')} className={chipClass(group === 'all')}>
              {t('abc.filter.all')}
            </button>
            {ABC_GROUPS.map((g) => (
              <button key={g} type="button" onClick={() => setGroup(g)} className={chipClass(group === g)}>
                {g}
              </button>
            ))}
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-x-4 gap-y-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('products.search_ph')}
              className="w-full max-w-[300px] rounded-[9px] border border-[#e6e8eb] bg-white px-3.5 py-2 text-sm text-[#1a1f25] outline-none transition-colors placeholder:text-[#9aa4b0] focus:border-[#c2c8cf]"
            />
            <div className="text-sm text-[#56616e]">
              {t('products.shown')}{' '}
              <span className="font-semibold tabular-nums text-[#1a1f25]">{rows.length}</span>
              {overview && rows.length !== overview.rows.length && (
                <span className="text-[#8a94a0]"> {t('products.of')} {overview.rows.length}</span>
              )}
            </div>
          </div>
        </div>

        {isLoading || !overview ? (
          <div className="px-5 py-12 text-center text-sm text-[#8a94a0]">{t('common.loading')}</div>
        ) : overview.rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[#8a94a0]">{t('abc.empty')}</div>
        ) : (
          <AbcTable rows={rows} />
        )}
      </section>

      {/* Смысл групп для владельца. */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <p className="m-0 rounded-[12px] border border-[#dceede] bg-[#f1f9f3] px-4 py-3 text-[13px] text-[#2c6b43]">
          {t('abc.note.a')}
        </p>
        <p className="m-0 rounded-[12px] border border-[#e6e8eb] bg-[#f7f8f9] px-4 py-3 text-[13px] text-[#56616e]">
          {t('abc.note.c')}
        </p>
      </div>
    </>
  );
}
