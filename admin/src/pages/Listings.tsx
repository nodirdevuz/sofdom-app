import { useState, useMemo } from 'react';
import { Search, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { OFFERS } from '../data/offers';
import { Offer } from '../data/types';
import { PageHeader } from '../components/PageHeader';

const RENTED_STORAGE_KEY = 'sofdom_rented_offers_v1';

export default function Listings() {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'early' | 'moderated' | 'local'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'rented'>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [rentedIds, setRentedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RENTED_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleStatus = (id: string) => {
    setRentedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(RENTED_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Storage sync error', e);
      }
      return next;
    });
  };

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

      const isRented = rentedIds.includes(o.id) || o.status === 'rented' || o.status === 'archived';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && !isRented) ||
        (statusFilter === 'rented' && isRented);

      const district = o.metro_name || 'Советский';
      const matchesDistrict = districtFilter === 'all' || district === districtFilter;

      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        o.title.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.phone && o.phone.includes(q));

      return matchesSource && matchesStatus && matchesDistrict && matchesSearch;
    });
  }, [offers, sourceFilter, statusFilter, districtFilter, search, rentedIds]);

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

      {/* Панель фильтров: каналы верификации + статус + поиск + выбор района */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={() => setSourceFilter('all')}
              className={chipClass(sourceFilter === 'all')}
            >
              Все источники
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
                placeholder="Поиск по адресу, тел, ID..."
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

        {/* Фильтр жизненного цикла объявлений: Сдано / В поиске */}
        <div className="flex items-center gap-2 pt-1 border-t border-[#f1f2f4]">
          <span className="text-[12px] font-semibold text-[#8a94a0] uppercase tracking-wider mr-1">Статус:</span>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-[7px] text-[12px] font-semibold transition-colors border ${
              statusFilter === 'all'
                ? 'bg-[#111418] text-white border-[#111418]'
                : 'bg-white text-[#56616e] border-[#e6e8eb] hover:bg-[#f7f8f9]'
            }`}
          >
            Все ({offers.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1 rounded-[7px] text-[12px] font-semibold transition-colors border flex items-center gap-1.5 ${
              statusFilter === 'active'
                ? 'bg-[#059669] text-white border-[#059669]'
                : 'bg-white text-[#059669] border-[#d1fae5] hover:bg-[#ecfdf5]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            Активные в поиске ({offers.length - rentedIds.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('rented')}
            className={`px-3 py-1 rounded-[7px] text-[12px] font-semibold transition-colors border flex items-center gap-1.5 ${
              statusFilter === 'rented'
                ? 'bg-[#e11d48] text-white border-[#e11d48]'
                : 'bg-white text-[#e11d48] border-[#ffe4e6] hover:bg-[#fff1f2]'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
            Снято / Сдано ({rentedIds.length})
          </button>
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
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left whitespace-nowrap">
                  Статус
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-right whitespace-nowrap">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 60).map((o: Offer) => {
                const ext = ((o as any).external_ref || o.source || '').toLowerCase();
                const isEarly = ext.includes('avito');
                const isModerated = ext.includes('cian');
                const isRented = rentedIds.includes(o.id) || o.status === 'rented' || o.status === 'archived';

                return (
                  <tr
                    key={o.id}
                    className={`border-b border-[#f1f2f4] transition-colors ${
                      isRented ? 'bg-[#fafafa] opacity-75 hover:bg-[#f3f4f6]' : 'hover:bg-[#fafbfc]'
                    }`}
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
                    <td className="px-5 py-[13px] whitespace-nowrap">
                      {isRented ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-[#fee2e2] text-[#991b1b]">
                          <XCircle size={13} />
                          Снято / Сдано
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-bold bg-[#d1fae5] text-[#065f46]">
                          <CheckCircle2 size={13} />
                          В поиске
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-[13px] text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleStatus(o.id)}
                          className={`px-2.5 py-1 rounded-[7px] text-[12px] font-semibold border transition-colors ${
                            isRented
                              ? 'bg-white text-[#059669] border-[#a7f3d0] hover:bg-[#ecfdf5]'
                              : 'bg-white text-[#e11d48] border-[#fecdd3] hover:bg-[#fff1f2]'
                          }`}
                          title={isRented ? 'Вернуть квартиру в публичный каталог' : 'Снять квартиру с поиска (сдано)'}
                        >
                          {isRented ? '↩ В поиск' : 'Снять (сдано)'}
                        </button>
                        <a
                          href={`https://nodirdevuz.github.io/sofdom-app/?offer=${o.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded-[7px] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
                          title="Открыть на сайте SofDom"
                        >
                          <Eye size={15} />
                        </a>
                      </div>
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
