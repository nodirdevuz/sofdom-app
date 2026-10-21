import { useMemo } from 'react';
import { OFFERS } from '../data/offers';
import { PageHeader } from '../components/PageHeader';

export default function Overview() {
  const offers = OFFERS;

  const stats = useMemo(() => {
    let avitoCount = 0;
    let cianCount = 0;
    let bezposrCount = 0;
    let totalSum = 0;

    const districts: Record<string, number> = {};

    offers.forEach((o) => {
      totalSum += o.price_val || 0;
      const src = (o.source || o.id || '').toLowerCase();
      if (src.includes('avito')) avitoCount++;
      else if (src.includes('cian')) cianCount++;
      else bezposrCount++;

      const d = o.metro_name || 'Советский';
      districts[d] = (districts[d] || 0) + 1;
    });

    const avgPrice = Math.round(totalSum / (offers.length || 1));

    return {
      total: offers.length,
      avito: avitoCount,
      cian: cianCount,
      bezposr: bezposrCount,
      avgPrice,
      districts,
    };
  }, [offers]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Пульс базы недвижимости"
        subtitle="Сводная аналитика лотов от собственников в Томске"
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Всего квартир</div>
          <div className="text-3xl font-extrabold text-[#0f172a] mt-2 tabular-nums">{stats.total}</div>
          <div className="text-xs font-medium text-[#10b981] mt-2 flex items-center gap-1">
            <span>●</span> 100% с проверенными телефонами
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Авито: Ранний доступ (6ч)</div>
          <div className="text-3xl font-extrabold text-[#f59e0b] mt-2 tabular-nums">12</div>
          <div className="text-xs font-medium text-[#64748b] mt-2">
            До выхода в общий публичный поиск
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Средняя арендная ставка</div>
          <div className="text-3xl font-extrabold text-[#3b82f6] mt-2 tabular-nums">
            {stats.avgPrice.toLocaleString('ru-RU')} ₽
          </div>
          <div className="text-xs font-medium text-[#64748b] mt-2">
            По всем 4 районам Томска
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Просмотров телефонов</div>
          <div className="text-3xl font-extrabold text-[#8b5cf6] mt-2 tabular-nums">48</div>
          <div className="text-xs font-medium text-[#10b981] mt-2">
            Прямые звонки собственникам
          </div>
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source breakdown */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-[#0f172a] mb-5">Каналы агрегации</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm font-semibold text-[#334155] mb-1.5">
                <span>Авито Недвижимость</span>
                <span>{stats.avito} кв. ({Math.round((stats.avito / stats.total) * 100)}%)</span>
              </div>
              <div className="w-full h-2.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#10b981] rounded-full"
                  style={{ width: `${(stats.avito / stats.total) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm font-semibold text-[#334155] mb-1.5">
                <span>ЦИАН (Собственники)</span>
                <span>{stats.cian} кв. ({Math.round((stats.cian / stats.total) * 100)}%)</span>
              </div>
              <div className="w-full h-2.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3b82f6] rounded-full"
                  style={{ width: `${(stats.cian / stats.total) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm font-semibold text-[#334155] mb-1.5">
                <span>БезПосредников.ру</span>
                <span>{stats.bezposr} кв. ({Math.round((stats.bezposr / stats.total) * 100)}%)</span>
              </div>
              <div className="w-full h-2.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#f59e0b] rounded-full"
                  style={{ width: `${(stats.bezposr / stats.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* District breakdown */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-[#0f172a] mb-5">География по районам Томска</h3>
          <div className="space-y-3.5">
            {Object.entries(stats.districts).map(([name, count]) => (
              <div key={name}>
                <div className="flex justify-between text-sm font-semibold text-[#334155] mb-1.5">
                  <span>{name}</span>
                  <span>{count} кв.</span>
                </div>
                <div className="w-full h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#6366f1] rounded-full"
                    style={{ width: `${(count / stats.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
