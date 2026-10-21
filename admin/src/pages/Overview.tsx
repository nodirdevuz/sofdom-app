import { useState, useMemo } from 'react';
import { OFFERS } from '../data/offers';
import { PageHeader } from '../components/PageHeader';

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-[#ecedf0] bg-white p-5">
      <h2 className="m-0 mb-4 text-[15px] font-semibold text-[#1a1f25]">{title}</h2>
      {children}
    </section>
  );
}

type SourceFilter = 'all' | 'avito' | 'cian' | 'bezposr';

export default function Overview() {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const offers = OFFERS;

  const stats = useMemo(() => {
    let avitoCount = 0;
    let cianCount = 0;
    let bezposrCount = 0;
    let totalSum = 0;

    const districts: Record<string, number> = {
      'Советский': 0,
      'Кировский': 0,
      'Ленинский': 0,
      'Октябрьский': 0,
    };

    offers.forEach((o) => {
      totalSum += o.price_val || 0;
      const src = (o.external_ref || o.source || o.id || '').toLowerCase();
      if (src.includes('avito')) avitoCount++;
      else if (src.includes('cian')) cianCount++;
      else bezposrCount++;

      const d = o.district || (o.metro_name ? o.metro_name.replace(' район', '') : 'Советский');
      const cleanD = d.includes('Совет') ? 'Советский' : d.includes('Киров') ? 'Кировский' : d.includes('Ленин') ? 'Ленинский' : 'Октябрьский';
      districts[cleanD] = (districts[cleanD] || 0) + 1;
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

  const chipClass = (active: boolean) =>
    `px-[14px] py-[7px] rounded-[9px] text-[13px] font-semibold whitespace-nowrap transition-colors border ${
      active
        ? 'bg-[#1f2937] text-white border-[#1f2937]'
        : 'bg-white text-[#56616e] border-[#e6e8eb] hover:bg-[#f7f8f9]'
    }`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Пульс базы"
        subtitle="Сводная аналитика лотов от собственников в Томске"
      />

      {/* Переключатель фильтров (стиль PeriodSwitcher из KomfortAdmin) */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSourceFilter('all')}
          className={chipClass(sourceFilter === 'all')}
        >
          Все лоты ({stats.total})
        </button>
        <button
          type="button"
          onClick={() => setSourceFilter('avito')}
          className={chipClass(sourceFilter === 'avito')}
        >
          ⚡ Ранний доступ ({stats.avito})
        </button>
        <button
          type="button"
          onClick={() => setSourceFilter('cian')}
          className={chipClass(sourceFilter === 'cian')}
        >
          🛡️ Модерация SofDom ({stats.cian})
        </button>
        <button
          type="button"
          onClick={() => setSourceFilter('bezposr')}
          className={chipClass(sourceFilter === 'bezposr')}
        >
          📍 Томск Локал ({stats.bezposr})
        </button>
      </div>

      {/* KPI Cards — точная палитра KomfortAdmin (#f7f8f9, border #ecedf0, text #111418, #7a8593) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[15px]">
        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            {stats.total}
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">Всего квартир</span>
            <span className="text-[12.5px] font-semibold text-[#5b6b7a]">100% с тел.</span>
          </div>
        </div>

        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            12
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">Ранний доступ</span>
            <span className="text-[12.5px] font-semibold text-[#5b6b7a]">до 6 часов</span>
          </div>
        </div>

        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            {stats.avgPrice.toLocaleString('ru-RU')} ₽
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">Средняя аренда</span>
            <span className="text-[12.5px] font-semibold text-[#5b6b7a]">в месяц</span>
          </div>
        </div>

        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            48
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">Открытий контактов</span>
            <span className="text-[12.5px] font-semibold text-[#5b6b7a]">сегодня</span>
          </div>
        </div>
      </div>

      {/* Две карточки-секции — строгий монохромный минимализм KomfortAdmin */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[15px]">
        <SectionCard title="Каналы агрегации">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-[13.5px] font-medium text-[#111418] mb-1.5">
                <span>⚡ Ранний доступ (Партнёр А)</span>
                <span className="text-[#5b6b7a] tabular-nums">{stats.avito} кв. ({Math.round((stats.avito / stats.total) * 100)}%)</span>
              </div>
              <div className="w-full h-2 bg-[#f1f2f4] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1f2937] rounded-full"
                  style={{ width: `${(stats.avito / stats.total) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[13.5px] font-medium text-[#111418] mb-1.5">
                <span>🛡️ Модерация SofDom (Партнёр Ц)</span>
                <span className="text-[#5b6b7a] tabular-nums">{stats.cian} кв. ({Math.round((stats.cian / stats.total) * 100)}%)</span>
              </div>
              <div className="w-full h-2 bg-[#f1f2f4] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#5b6b7a] rounded-full"
                  style={{ width: `${(stats.cian / stats.total) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[13.5px] font-medium text-[#111418] mb-1.5">
                <span>📍 Прямой собственник (Томск Локал)</span>
                <span className="text-[#5b6b7a] tabular-nums">{stats.bezposr} кв. ({Math.round((stats.bezposr / stats.total) * 100)}%)</span>
              </div>
              <div className="w-full h-2 bg-[#f1f2f4] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8a94a0] rounded-full"
                  style={{ width: `${(stats.bezposr / stats.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="География по районам Томска">
          <div className="space-y-3.5">
            {Object.entries(stats.districts).map(([name, count]) => (
              <div key={name}>
                <div className="flex justify-between text-[13.5px] font-medium text-[#111418] mb-1">
                  <span>{name}</span>
                  <span className="text-[#5b6b7a] font-semibold tabular-nums">{count} кв.</span>
                </div>
                <div className="w-full h-1.5 bg-[#f1f2f4] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1f2937] rounded-full"
                    style={{ width: `${(count / stats.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
