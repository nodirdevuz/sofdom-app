import { PageHeader } from '../components/PageHeader';
import { ShieldCheck, Check } from 'lucide-react';

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
        title="Сборщики данных и Модерация"
        subtitle="Мониторинг парсеров, анти-риелторская фильтрация собственников и кэш"
      />

      {/* KPI Cards — точная палитра KomfortAdmin */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[15px]">
        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            162 / 504
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">Одобрено собственников</span>
            <span className="text-[12px] font-semibold text-[#5b6b7a]">32% чистых</span>
          </div>
        </div>

        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            342
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">Отсеяно риелторов</span>
            <span className="text-[12px] font-semibold text-[#5b6b7a]">68% спама</span>
          </div>
        </div>

        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            4 потока
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">Активных сборщиков</span>
            <span className="text-[12px] font-semibold text-[#111418]">все активны</span>
          </div>
        </div>
      </div>

      {/* Scrapers Status Table */}
      <div className="border border-[#ecedf0] rounded-[14px] overflow-hidden bg-white">
        <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-b border-[#f1f2f4]">
          <div>
            <div className="text-[15px] font-semibold text-[#111418]">Фоновые сборщики (Томск)</div>
            <div className="text-[12.5px] text-[#8a94a0] mt-0.5">
              Захват всех объявлений: ранний доступ + полный каталог с модерацией хозяев
            </div>
          </div>
          <div className="text-[12.5px] text-[#8a94a0] font-medium bg-[#f3f4f6] px-2.5 py-[3px] rounded-full">
            4 сборщика
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Площадка и поток
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Интервал
                </th>
                <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                  Логика и фильтрация
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
                <td className="px-5 py-[13px] text-[#5b6b7a] text-[13.5px] tabular-nums">30 сек</td>
                <td className="px-5 py-[13px] text-[#8a94a0] text-[13px]">
                  Перехват pre-index лотов (до 6ч до появления в поиске)
                </td>
                <td className="px-5 py-[13px]">
                  <span className="inline-block px-2.5 py-0.5 rounded-[6px] text-[12px] font-semibold bg-[#1f2937] text-white">
                    Активен
                  </span>
                </td>
              </tr>
              <tr className="border-b border-[#f1f2f4] hover:bg-[#fafbfc] transition-colors">
                <td className="px-5 py-[13px] font-semibold text-[#111418] text-[13.5px]">
                  Авито (Общий поток + Модерация)
                </td>
                <td className="px-5 py-[13px] text-[#5b6b7a] text-[13.5px] tabular-nums">1 мин</td>
                <td className="px-5 py-[13px] text-[#8a94a0] text-[13px]">
                  Сбор ВСЕХ новых лотов с анти-риелторским скорингом собственника
                </td>
                <td className="px-5 py-[13px]">
                  <span className="inline-block px-2.5 py-0.5 rounded-[6px] text-[12px] font-semibold bg-[#1f2937] text-white">
                    Активен
                  </span>
                </td>
              </tr>
              <tr className="border-b border-[#f1f2f4] hover:bg-[#fafbfc] transition-colors">
                <td className="px-5 py-[13px] font-semibold text-[#111418] text-[13.5px]">
                  БезПосредников (bsps.ru)
                </td>
                <td className="px-5 py-[13px] text-[#5b6b7a] text-[13.5px] tabular-nums">5 мин</td>
                <td className="px-5 py-[13px] text-[#8a94a0] text-[13px]">
                  100% прямые хозяева без агентств (39 лотов в базе)
                </td>
                <td className="px-5 py-[13px]">
                  <span className="inline-block px-2.5 py-0.5 rounded-[6px] text-[12px] font-semibold bg-[#1f2937] text-white">
                    Активен
                  </span>
                </td>
              </tr>
              <tr className="border-b border-[#f1f2f4] hover:bg-[#fafbfc] transition-colors">
                <td className="px-5 py-[13px] font-semibold text-[#111418] text-[13.5px]">
                  ЦИАН (Прямые собственники)
                </td>
                <td className="px-5 py-[13px] text-[#5b6b7a] text-[13.5px] tabular-nums">2 мин</td>
                <td className="px-5 py-[13px] text-[#8a94a0] text-[13px]">
                  Фильтрация комиссии 0% и проверка выписки ЕГРН
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

      {/* Анти-риелторский скоринг и правила модерации */}
      <div className="border border-[#ecedf0] rounded-[14px] p-5 bg-white space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={18} className="text-[#111418]" />
          <h3 className="font-semibold text-[#111418] text-[15px]">
            Алгоритм модерации «Реальный хозяин»:
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[13px]">
          <div className="border border-[#f1f2f4] rounded-[10px] p-3.5 bg-[#fbfbfc] space-y-1.5">
            <div className="font-semibold text-[#111418] flex items-center gap-1.5">
              <Check size={14} className="text-[#111418]" /> Проверка номера
            </div>
            <p className="text-[#7a8593] leading-relaxed">
              Если номер телефона встречается более чем в 1–2 активных квартирах — лот признается агентством и блокируется.
            </p>
          </div>

          <div className="border border-[#f1f2f4] rounded-[10px] p-3.5 bg-[#fbfbfc] space-y-1.5">
            <div className="font-semibold text-[#111418] flex items-center gap-1.5">
              <Check size={14} className="text-[#111418]" /> Стоп-слова риелторов
            </div>
            <p className="text-[#7a8593] leading-relaxed">
              Автоматический брак при наличии слов: «комиссия», «агентство», «услуги риелтора», «залог агентству», «договор».
            </p>
          </div>

          <div className="border border-[#f1f2f4] rounded-[10px] p-3.5 bg-[#fbfbfc] space-y-1.5">
            <div className="font-semibold text-[#111418] flex items-center gap-1.5">
              <Check size={14} className="text-[#111418]" /> Маркеры хозяина
            </div>
            <p className="text-[#7a8593] leading-relaxed">
              Повышенный VIP-скоринг лотам со словами: «я собственник», «сдам лично», «без комиссии», «хозяин».
            </p>
          </div>
        </div>
      </div>

      {/* Cache Control Card */}
      <div className="border border-[#ecedf0] rounded-[14px] p-5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="font-semibold text-[#111418] text-[14.5px]">
            Управление локальным кэшем картинок
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
