import { KPICard } from '../components/KPICard';
import { Skeleton } from '../components/Skeleton';
import { PeriodSwitcher } from '../components/dashboard/PeriodSwitcher';
import { TopProductsTable } from '../components/inventory/TopProductsTable';
import { DeadStockTable } from '../components/inventory/DeadStockTable';
import { useInventory } from '../data/useInventory';
import { usePeriod } from '../hooks/usePeriod';
import { useT } from '../i18n';
import { formatInt, formatMoney } from '../lib/format';
import { periodLabel, type PeriodPreset } from '../lib/period';
import type { Kpi } from '../types';

// «Деньги на полках» меряют застой: пресеты — окна «нет продаж за 30/60/90 дней».
const INVENTORY_PRESETS: PeriodPreset[] = ['last30', 'last60', 'last90', 'custom'];

export default function Inventory() {
  const t = useT();
  const { preset, custom, period, setPreset, handleCustomChange } = usePeriod('last30');
  const { overview, isLoading, error } = useInventory(period);

  const kpis: Kpi[] = overview
    ? [
        { value: formatInt(overview.kpi.inStockCount), label: t('inventory.kpi.in_stock') },
        { value: formatInt(overview.kpi.deadCount), label: t('inventory.kpi.dead') },
        { value: formatMoney(overview.kpi.frozenCapital), label: t('inventory.kpi.frozen') },
      ]
    : [];

  return (
    <>
      <header className="mb-5 flex flex-col gap-4">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-[-0.02em] sm:text-[25px]">
            {t('nav.dead')}
          </h1>
          <p className="mb-0 mt-[5px] text-sm text-[#8a94a0]">
            {t('inventory.subtitle')} · {periodLabel(preset, period, t)}
          </p>
        </div>
        <PeriodSwitcher
          preset={preset}
          custom={custom}
          onPresetChange={setPreset}
          onCustomChange={handleCustomChange}
          presets={INVENTORY_PRESETS}
        />
      </header>

      {error && (
        <div className="mb-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {t('common.load_error')} {error}
        </div>
      )}

      {/* KPI: товаров с остатком · из них мёртвых · замороженный капитал */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(218px,1fr))] gap-[15px]">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)
          : kpis.map((k) => <KPICard key={k.label} kpi={k} />)}
      </div>

      {/* Лево — топ товаров · Право — мёртвый сток */}
      <div className="mt-[22px] grid grid-cols-1 gap-[15px] lg:grid-cols-2">
        {isLoading || !overview ? (
          <>
            <Skeleton className="h-[360px]" />
            <Skeleton className="h-[360px]" />
          </>
        ) : (
          <>
            <TopProductsTable rows={overview.top} />
            <DeadStockTable rows={overview.dead} />
          </>
        )}
      </div>
    </>
  );
}
