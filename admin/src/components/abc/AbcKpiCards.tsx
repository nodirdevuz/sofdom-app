import { formatInt, formatPercent } from '../../lib/format';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n/dictionaries/ru';
import { ABC_GROUPS, type AbcGroup, type AbcOverview } from '../../lib/abc';
import { AbcBadge, GROUP_ACCENT } from './AbcBadge';

const META: Record<AbcGroup, { title: TranslationKey; hint: TranslationKey }> = {
  A: { title: 'abc.kpi.a', hint: 'abc.kpi.a_hint' },
  B: { title: 'abc.kpi.b', hint: 'abc.kpi.b_hint' },
  C: { title: 'abc.kpi.c', hint: 'abc.kpi.c_hint' },
};

/** 3 карточки-сводки: сколько товаров в группе и какой % метрики они дают. */
export function AbcKpiCards({ overview }: { overview: AbcOverview }) {
  const t = useT();
  const ofMetric = overview.metric === 'profit' ? t('abc.kpi.of_profit') : t('abc.kpi.of_revenue');

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(218px,1fr))] gap-[15px]">
      {ABC_GROUPS.map((g) => {
        const s = overview.groups[g];
        return (
          <div
            key={g}
            className="relative overflow-hidden rounded-[14px] border border-[#ecedf0] bg-[#f7f8f9] px-5 py-[18px]"
          >
            <span
              className="absolute left-0 top-0 h-full w-[3px]"
              style={{ background: GROUP_ACCENT[g] }}
            />
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[#56616e]">{t(META[g].title)}</span>
              <AbcBadge group={g} />
            </div>
            <div className="mt-2 text-[29px] font-bold leading-[1.1] tracking-[-0.02em] tabular-nums">
              {formatInt(s.count)}{' '}
              <span className="text-[15px] font-semibold text-[#7a8593]">{t('abc.kpi.products')}</span>
            </div>
            <div className="mt-1.5 text-[13px] text-[#7a8593]">
              <span className="font-semibold text-[#3a4654]">{formatPercent(s.pct)}</span> {ofMetric} ·{' '}
              {t(META[g].hint)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
