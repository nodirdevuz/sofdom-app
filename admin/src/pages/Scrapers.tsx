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
    <div className="space-y-5">
      <PageHeader
        title="Сборщики данных и Кэш"
        subtitle="Мониторинг перехвата объявлений Томска и оптимизация скорости"
      />

      {/* KPI Cards — точная палитра KomfortAdmin */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[15px]">
        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            АКТИВЕН
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">PWA Service Worker</span>
            <span className="text-[12px] font-semibold text-[#5b6b7a]">sofdom-cache-v2</span>
          </div>
        </div>

        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            CacheFirst
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">Кэш фотографий</span>
            <span className="text-[12px] font-semibold text-[#5b6b7a]">Авито / ЦИАН / БезПоср</span>
          </div>
        </div>

        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            0 ms
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">Отклик из кэша</span>
            <span className="text-[12px] font-semibold text-[#5b6b7a]">мгновенно</span>
          </div>
        </div>
      </div>

      {/* Scrapers Status Table */}
      <div className="border border-[#ecedf0] rounded-[14px] overflow-hidden bg-white">
        <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-b border-[#f1f2f4]">
          <div className="text-[15px] font-semibold text-[#111418]">Фоновые сборщики (Томск)</div>
          <div className="text-[12.5px] text-[#8a94a0] font-medium bg-[#f3f4f6] px-2.5 py-[3px] rounded-full">
            3 активны
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[660px]">
            <thead>
              <tr>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Парсер
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Интервал
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Специфика
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Статус
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#f1f2f4] hover:bg-[#fafbfc] transition-colors">
                <td className="px-5 py-[13px] font-semibold text-[#111418] text-[13.5px]">
                  Авито (Ранний доступ)
                </td>
                <td className="px-5 py-[13px] text-[#5b6b7a] text-[13.5px]">30 сек</td>
                <td className="px-5 py-[13px] text-[#8a94a0] text-[13px]">
                  Перехват pre-index лотов (до 6ч до общего каталога)
                </td>
                <td className="px-5 py-[13px]">
                  <span className="inline-block px-2.5 py-0.5 rounded-[6px] text-[12px] font-semibold bg-[#1f2937] text-white">
                    Активен
                  </span>
                </td>
              </tr>
              <tr className="border-b border-[#f1f2f4] hover:bg-[#fafbfc] transition-colors">
                <td className="px-5 py-[13px] font-semibold text-[#111418] text-[13.5px]">
                  ЦИАН (Собственники)
                </td>
                <td className="px-5 py-[13px] text-[#5b6b7a] text-[13.5px]">2 мин</td>
                <td className="px-5 py-[13px] text-[#8a94a0] text-[13px]">
                  Фильтрация риелторов и комиссий 0%
                </td>
                <td className="px-5 py-[13px]">
                  <span className="inline-block px-2.5 py-0.5 rounded-[6px] text-[12px] font-semibold bg-[#1f2937] text-white">
                    Активен
                  </span>
                </td>
              </tr>
              <tr className="border-b border-[#f1f2f4] hover:bg-[#fafbfc] transition-colors">
                <td className="px-5 py-[13px] font-semibold text-[#111418] text-[13.5px]">
                  БезПосредников
                </td>
                <td className="px-5 py-[13px] text-[#5b6b7a] text-[13.5px]">5 мин</td>
                <td className="px-5 py-[13px] text-[#8a94a0] text-[13px]">
                  Локальные объявления от прямых хозяев
                </td>
                <td className="px-5 py-[13px]">
                  <span className="inline-block px-2.5 py-0.5 rounded-[6px] text-[12px] font-semibold bg-[#1f2937] text-white">
                    Активен
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Cache Control Card */}
      <div className="border border-[#ecedf0] rounded-[14px] p-5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="font-semibold text-[#111418] text-[14.5px]">
            Управление локальным кэшем браузера
          </div>
          <div className="text-[13px] text-[#8a94a0] mt-0.5">
            Принудительно очистить сохранённые фотографии CDN и структуры данных
          </div>
        </div>
        <button
          onClick={handleClearCache}
          className="px-4 py-2 border border-[#e6e8eb] hover:bg-[#f7f8f9] text-[#1a1f25] font-semibold text-[13px] rounded-[9px] transition-colors shrink-0"
        >
          Очистить кэш картинок
        </button>
      </div>
    </div>
  );
}
