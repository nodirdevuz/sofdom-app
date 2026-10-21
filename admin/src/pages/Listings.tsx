import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { OFFERS } from '../data/offers';
import { Offer } from '../data/types';
import { PageHeader } from '../components/PageHeader';

export default function Listings() {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'early' | 'moderated' | 'local'>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');

  const offers = OFFERS;

  const filtered = useMemo(() => {
    return offers.filter((o: Offer) => {
      const ext = ((o as any).external_ref || o.source || '').toLowerCase();
      const isEarly = ext.includes('avito');
      const isModerated = ext.includes('cian');
      const isLocal = !isEarly && !isModerated;

      const matchesSource =
        sourceFilter === 'all' ||
        (sourceFilter === 'early' && isEarly) ||
        (sourceFilter === 'moderated' && isModerated) ||
        (sourceFilter === 'local' && isLocal);

      const district = o.metro_name || 'Советский';
      const matchesDistrict = districtFilter === 'all' || district === districtFilter;

      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        o.title.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.phone && o.phone.includes(q));

      return matchesSource && matchesDistrict && matchesSearch;
    });
  }, [offers, sourceFilter, districtFilter, search]);

  const chipClass = (active: boolean) =>
    `px-[13px] py-[6px] rounded-[9px] text-[13px] font-semibold whitespace-nowrap transition-colors border ${
      active
        ? 'bg-[#1f2937] text-white border-[#1f2937]'
        : 'bg-white text-[#56616e] border-[#e6e8eb] hover:bg-[#f7f8f9]'
    }`;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Объявления SofDom"
        subtitle={`Единая база предложений от собственников (${filtered.length} из ${offers.length})`}
      />

      {/* Панель фильтров: каналы верификации + поиск + выбор района */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => setSourceFilter('all')}
            className={chipClass(sourceFilter === 'all')}
          >
            Все лоты
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('early')}
            className={chipClass(sourceFilter === 'early')}
          >
            ⚡ Ранний доступ
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('moderated')}
            className={chipClass(sourceFilter === 'moderated')}
          >
            🛡️ Модерация SofDom
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('local')}
            className={chipClass(sourceFilter === 'local')}
          >
            📍 Томск Локал
          </button>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
          <div className="relative flex-1 sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9aa4b0]">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Поиск по адресу, тел..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-[7px] border border-[#e6e8eb] rounded-[9px] text-[13px] bg-white outline-none text-[#1a1f25] placeholder-[#9aa4b0] focus:border-[#1f2937] transition-colors"
            />
          </div>

          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="px-[11px] py-[7px] border border-[#e6e8eb] rounded-[9px] text-[13px] bg-white text-[#1a1f25] font-medium outline-none focus:border-[#1f2937]"
          >
            <option value="all">Все районы</option>
            <option value="Советский">Советский</option>
            <option value="Кировский">Кировский</option>
            <option value="Ленинский">Ленинский</option>
            <option value="Октябрьский">Октябрьский</option>
          </select>
        </div>
      </div>

      {/* Таблица данных — эталонная вёрстка DataTable из KomfortAdmin */}
      <div className="border border-[#ecedf0] rounded-[14px] overflow-hidden bg-white">
        <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-b border-[#f1f2f4]">
          <div className="text-[15px] font-semibold text-[#111418]">Список предложений</div>
          <div className="text-[12.5px] text-[#8a94a0] font-medium bg-[#f3f4f6] px-2.5 py-[3px] rounded-full">
            {filtered.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[720px]">
            <thead>
              <tr>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left whitespace-nowrap">
                  Источник
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left whitespace-nowrap">
                  Объект
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left whitespace-nowrap">
                  Район / Адрес
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-right whitespace-nowrap">
                  Цена
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left whitespace-nowrap">
                  Телефон
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-center whitespace-nowrap">
                  Фото
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 60).map((o: Offer) => {
                const ext = ((o as any).external_ref || o.source || '').toLowerCase();
                const isEarly = ext.includes('avito');
                const isModerated = ext.includes('cian');

                return (
                  <tr
                    key={o.id}
                    className="border-b border-[#f1f2f4] hover:bg-[#fafbfc] transition-colors"
                  >
                    <td className="px-5 py-[13px] whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[12px] font-semibold ${
                          isEarly
                            ? 'bg-[#1f2937] text-white'
                            : isModerated
                            ? 'bg-[#e8ebef] text-[#3a4654]'
                            : 'bg-[#eef0f2] text-[#5a6675]'
                        }`}
                      >
                        {isEarly ? '⚡ Ранний' : isModerated ? '🛡️ SofDom' : '📍 Локал'}
                      </span>
                    </td>
                    <td className="px-5 py-[13px]">
                      <div className="font-semibold text-[#111418] text-[13.5px]">{o.title}</div>
                      <div className="text-[12px] text-[#475569] font-medium tabular-nums">№ {o.id}</div>
                    </td>
                    <td className="px-5 py-[13px]">
                      <div className="text-[#1a1f25] text-[13.5px]">{o.address}</div>
                      <div className="text-[12px] text-[#8a94a0]">
                        {o.metro_name || 'Советский р-н'}
                      </div>
                    </td>
                    <td className="px-5 py-[13px] text-right whitespace-nowrap">
                      <span className="font-bold text-[#111418] text-[14px] tabular-nums">
                        {(o.price_val || 0).toLocaleString('ru-RU')} ₽
                      </span>
                    </td>
                    <td className="px-5 py-[13px] whitespace-nowrap">
                      <a
                        href={`tel:${o.phone}`}
                        className="font-semibold text-[#111418] text-[13.5px] hover:underline"
                      >
                        {o.phone || '—'}
                      </a>
                    </td>
                    <td className="px-5 py-[13px] text-center text-[12.5px] text-[#7a8593] whitespace-nowrap tabular-nums">
                      {o.photos?.length || 1} шт.
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
