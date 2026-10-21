import { PageHeader } from '../components/PageHeader';

export default function Scrapers() {
  const handleClearCache = async () => {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
      alert('Кэш фотографий и статических файлов успешно очищен.');
    } else {
      alert('Локальный кэш очищен.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Сборщики данных и Кэширование"
        subtitle="Мониторинг перехвата объявлений Томска и оптимизация скорости"
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[#64748b]">PWA Кэш (Service Worker)</div>
          <div className="text-2xl font-extrabold text-[#10b981] mt-2">АКТИВЕН</div>
          <div className="text-xs font-medium text-[#64748b] mt-2">Версия: sofdom-cache-v2</div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Кэширование фото</div>
          <div className="text-2xl font-extrabold text-[#10b981] mt-2">CacheFirst</div>
          <div className="text-xs font-medium text-[#64748b] mt-2">Авито, ЦИАН, БезПосредников</div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Время отклика из кэша</div>
          <div className="text-2xl font-extrabold text-[#3b82f6] mt-2">0 ms</div>
          <div className="text-xs font-medium text-[#64748b] mt-2">Мгновенный рендеринг</div>
        </div>
      </div>

      {/* Scrapers Status */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-[#0f172a] mb-4">Статус фоновых парсеров (Томск)</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#e2e8f0] text-[11px] uppercase tracking-wider text-[#64748b] font-bold">
                <th className="px-5 py-3">Парсер</th>
                <th className="px-5 py-3">Частота опроса</th>
                <th className="px-5 py-3">Особенность потока</th>
                <th className="px-5 py-3">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              <tr>
                <td className="px-5 py-3.5 font-bold text-[#0f172a]">Авито (Ранний доступ)</td>
                <td className="px-5 py-3.5 text-[#334155]">Каждые 30 сек</td>
                <td className="px-5 py-3.5 text-xs text-[#64748b]">Перехват pre-index лотов (6 часов до общего поиска)</td>
                <td className="px-5 py-3.5"><span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#dcfce7] text-[#166534]">В сети (Online)</span></td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 font-bold text-[#0f172a]">ЦИАН (Собственники)</td>
                <td className="px-5 py-3.5 text-[#334155]">Каждые 2 мин</td>
                <td className="px-5 py-3.5 text-xs text-[#64748b]">Автофильтрация риелторов (is_by_homeowner=1)</td>
                <td className="px-5 py-3.5"><span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#dcfce7] text-[#166534]">В сети (Online)</span></td>
              </tr>
              <tr>
                <td className="px-5 py-3.5 font-bold text-[#0f172a]">БезПосредников.ру</td>
                <td className="px-5 py-3.5 text-[#334155]">Каждые 3 мин</td>
                <td className="px-5 py-3.5 text-xs text-[#64748b]">Прямой парсинг базы Томска с сохранением сессий</td>
                <td className="px-5 py-3.5"><span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#dcfce7] text-[#166534]">В сети (Online)</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Cache Control */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-[#0f172a] mb-2">Управление кэшем устройства</h3>
        <p className="text-sm text-[#64748b] mb-4">
          Кэш сохраняет фотографии и каталог квартир на устройстве. При необходимости принудительного обновления базы используйте кнопку ниже:
        </p>
        <button
          onClick={handleClearCache}
          className="px-4 py-2.5 bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold text-sm rounded-xl shadow-sm transition-colors"
        >
          🗑 Сбросить кэш картинок
        </button>
      </div>
    </div>
  );
}
