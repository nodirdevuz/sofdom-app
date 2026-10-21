import { useState, useMemo } from 'react';
import { OFFERS } from '../data/offers';
import { Offer } from '../data/types';
import { PageHeader } from '../components/PageHeader';

export default function Listings() {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'avito' | 'cian' | 'bezposr'>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');

  const offers = OFFERS;

  const filtered = useMemo(() => {
    return offers.filter((o: Offer) => {
      const src = (o.source || o.id || '').toLowerCase();
      const matchesSource =
        sourceFilter === 'all' ||
        (sourceFilter === 'avito' && src.includes('avito')) ||
        (sourceFilter === 'cian' && src.includes('cian')) ||
        (sourceFilter === 'bezposr' && (src.includes('bezposr') || (!src.includes('avito') && !src.includes('cian'))));

      const district = o.metro_name || 'Советский';
      const matchesDistrict = districtFilter === 'all' || district === districtFilter;

      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        o.title.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q) ||
        (o.phone && o.phone.includes(q));

      return matchesSource && matchesDistrict && matchesSearch;
    });
  }, [offers, sourceFilter, districtFilter, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Каталог объявлений Томска"
        subtitle={`База аренды квартир от прямых собственников (${filtered.length} из ${offers.length})`}
      />

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <input
          type="text"
          placeholder="Поиск по адресу, названию или номеру телефона..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-96 px-4 py-2 border border-[#cbd5e1] rounded-xl text-sm outline-none focus:border-[#10b981] bg-[#f8fafc]"
        />

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <select
            value={sourceFilter}
            onChange={(e: any) => setSourceFilter(e.target.value)}
            className="px-3 py-2 border border-[#cbd5e1] rounded-xl text-xs font-semibold bg-white text-[#334155]"
          >
            <option value="all">Все источники</option>
            <option value="avito">Авито</option>
            <option value="cian">ЦИАН</option>
            <option value="bezposr">БезПосредников</option>
          </select>

          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="px-3 py-2 border border-[#cbd5e1] rounded-xl text-xs font-semibold bg-white text-[#334155]"
          >
            <option value="all">Все районы Томска</option>
            <option value="Советский">Советский</option>
            <option value="Кировский">Кировский</option>
            <option value="Ленинский">Ленинский</option>
            <option value="Октябрьский">Октябрьский</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#e2e8f0] text-[11px] uppercase tracking-wider text-[#64748b] font-bold">
                <th className="px-5 py-3.5">Источник</th>
                <th className="px-5 py-3.5">Квартира</th>
                <th className="px-5 py-3.5">Район / Адрес</th>
                <th className="px-5 py-3.5 text-right">Цена</th>
                <th className="px-5 py-3.5">Телефон собственника</th>
                <th className="px-5 py-3.5 text-center">Фото</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filtered.slice(0, 100).map((o: Offer) => {
                const src = (o.source || o.id || '').toLowerCase();
                const isAvito = src.includes('avito');
                const isCian = src.includes('cian');

                return (
                  <tr key={o.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          isAvito
                            ? 'bg-[#dcfce7] text-[#166534]'
                            : isCian
                            ? 'bg-[#dbeafe] text-[#1e40af]'
                            : 'bg-[#fef3c7] text-[#92400e]'
                        }`}
                      >
                        {isAvito ? 'Авито' : isCian ? 'ЦИАН' : 'БезПосредников'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-[#0f172a]">{o.title}</div>
                      <div className="text-xs text-[#94a3b8]">ID: {o.id}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-[#334155]">{o.address}</div>
                      <div className="text-xs font-semibold text-[#64748b]">
                        {o.metro_name || 'Советский р-н'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <span className="font-extrabold text-[#0f172a]">
                        {(o.price_val || 0).toLocaleString('ru-RU')} ₽
                      </span>
                      <span className="text-xs text-[#94a3b8]">/мес</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <a
                        href={`tel:${o.phone}`}
                        className="inline-flex items-center gap-1.5 font-bold text-[#059669] hover:underline"
                      >
                        <span>📞</span> {o.phone || 'Нет номера'}
                      </a>
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs font-semibold text-[#64748b] whitespace-nowrap">
                      📷 {o.photos?.length || 1} шт.
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
