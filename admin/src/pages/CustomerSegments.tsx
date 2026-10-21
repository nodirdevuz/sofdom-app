import { useMemo } from 'react';
import { PeriodSwitcher } from '../components/dashboard/PeriodSwitcher';
import { DataTable, type Column } from '../components/DataTable';
import { KPICard } from '../components/KPICard';
import { Skeleton } from '../components/Skeleton';
import { SegmentBounds } from '../components/segments/SegmentBounds';
import { useSegments } from '../data/useSegments';
import { usePeriod } from '../hooks/usePeriod';
import { useSegmentBounds } from '../hooks/useSegmentBounds';
import { useT } from '../i18n';
import { formatDecimal, formatInt, formatMoney } from '../lib/format';
import { periodLabel, type PeriodPreset } from '../lib/period';
import { segmentLabel, type SegmentRow } from '../lib/segments';

const SEGMENT_PRESETS: PeriodPreset[] = ['today', 'last7', 'last30', 'last365', 'custom'];

export default function CustomerSegments() {
  const t = useT();
  const { preset, custom, period, setPreset, handleCustomChange } = usePeriod('last30');

  // Границы владельца. Живут между заходами: он настраивает их под свой магазин один раз.
  const { bounds, setBounds, valid } = useSegmentBounds();

  const { overview, isLoading, error } = useSegments(period, bounds, valid);

  const money = (v: number) => formatMoney(v);
  // Порядок слов задаёт перевод, а не код: по-узбекски послелог стоит ПОСЛЕ числа.
  const labelTemplates = {
    upTo: t('segments.label.up_to'),
    from: t('segments.label.from'),
    range: t('segments.label.range'),
  };

  const columns: Column<SegmentRow>[] = useMemo(
    () => [
      {
        key: 'segment',
        label: t('segments.col.segment'),
        render: (r) => <span className="font-medium">{segmentLabel(r, money, labelTemplates)}</span>,
      },
      {
        key: 'receipts',
        label: t('segments.col.receipts'),
        align: 'right',
        render: (r) => formatInt(r.receipts),
      },
      {
        key: 'receipts_share',
        label: t('segments.col.receipts_share'),
        align: 'right',
        render: (r) => t('segments.percent_value').replace('{value}', formatDecimal(r.receipts_share)),
        cellClassName: 'font-semibold',
      },
      {
        key: 'revenue',
        label: t('segments.col.revenue'),
        align: 'right',
        render: (r) => formatMoney(r.revenue),
      },
      {
        key: 'revenue_share',
        label: t('segments.col.revenue_share'),
        align: 'right',
        render: (r) => t('segments.percent_value').replace('{value}', formatDecimal(r.revenue_share)),
        cellClassName: 'font-semibold',
      },
      {
        key: 'avg_check',
        label: t('segments.col.avg_check'),
        align: 'right',
        render: (r) => formatMoney(r.avg_check),
      },
      {
        key: 'avg_items',
        label: t('segments.col.avg_items'),
        align: 'right',
        render: (r) => formatDecimal(r.avg_items),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const upperSegments = overview?.segments.slice(-2) ?? [];
  const upperReceiptsShare = Math.round(
    upperSegments.reduce((sum, row) => sum + row.receipts_share, 0),
  );
  const upperRevenueShare = Math.round(
    upperSegments.reduce((sum, row) => sum + row.revenue_share, 0) * 10,
  ) / 10;

  return (
    <>
      <header className="mb-5 flex flex-col gap-4">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">
            {t('nav.segments')}
          </h1>
          <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">
            {t('segments.subtitle')} · {periodLabel(preset, period, t)}
          </p>
        </div>
        <PeriodSwitcher
          preset={preset}
          custom={custom}
          onPresetChange={setPreset}
          onCustomChange={handleCustomChange}
          presets={SEGMENT_PRESETS}
        />
        <SegmentBounds bounds={bounds} onChange={setBounds} />
      </header>

      {error && (
        <div className="mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {t('common.load_error')} {error}
        </div>
      )}

      {/* Итоги периода приходят из функции базы, здесь они не пересчитываются. */}
      {isLoading || !overview ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(218px,1fr))] gap-[15px]">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-[116px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(218px,1fr))] gap-[15px]">
          <KPICard kpi={{ value: formatInt(overview.totals.receipts), label: t('segments.kpi.receipts') }} />
          <KPICard kpi={{ value: formatMoney(overview.totals.revenue), label: t('segments.kpi.revenue') }} />
        </div>
      )}

      {isLoading || !overview ? (
        <div className="mt-[26px] rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
          {t('common.loading')}
        </div>
      ) : overview.segments.length === 0 ? (
        <div className="mt-[26px] rounded-[14px] border border-[#ecedf0] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
          {t('segments.empty')}
        </div>
      ) : (
        <DataTable
          title={t('segments.table_title')}
          count={overview.segments.length}
          columns={columns}
          rows={overview.segments}
          rowKey={(r) => `${r.min_amount}-${r.max_amount ?? 'max'}`}
          footerCells={[
            t('segments.total'),
            formatInt(overview.totals.receipts),
            overview.totals.receipts > 0 ? t('segments.share_total') : t('segments.share_empty'),
            formatMoney(overview.totals.revenue),
            overview.totals.revenue > 0 ? t('segments.share_total') : t('segments.share_empty'),
            t('segments.not_applicable'),
            t('segments.not_applicable'),
          ]}
          mobileCards
        />
      )}

      {overview && overview.segments.length > 1 && (
        <p className="m-0 mt-4 rounded-[12px] border border-[#d9e8df] bg-[#f0f8f3] px-4 py-3 text-[13px] font-semibold leading-[1.5] text-[#35704a]">
          {t('segments.upper_summary')
            .replace('{receipts_share}', formatInt(upperReceiptsShare))
            .replace('{revenue_share}', formatDecimal(upperRevenueShare))}
        </p>
      )}
    </>
  );
}
