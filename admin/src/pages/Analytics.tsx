import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import {
  getFunnelStepsData,
  getRecentSessionsData,
  getFrictionErrorsData,
} from '../data/analyticsData';

type Tab = 'steps' | 'sessions' | 'errors';

export default function Analytics() {
  const [tab, setTab] = useState<Tab>('steps');
  const steps = getFunnelStepsData();
  const sessions = getRecentSessionsData();
  const errors = getFrictionErrorsData();

  const chipClass = (active: boolean) =>
    `px-[14px] py-[7px] rounded-[9px] text-[13px] font-semibold whitespace-nowrap transition-colors border ${
      active
        ? 'bg-[#1f2937] text-white border-[#1f2937]'
        : 'bg-white text-[#56616e] border-[#e6e8eb] hover:bg-[#f7f8f9]'
    }`;

  const reachedPhone = steps.find((s) => s.key === 'phone_reveal')?.count || 285;
  const totalVisits = steps[0]?.count || 1240;
  const conversionRate = ((reachedPhone / totalVisits) * 100).toFixed(1);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Аналитика и Датчики"
        subtitle="Сквозная воронка пути клиента, сессии, глубина просмотра и детектор сбоев"
      />

      {/* Верхние KPI метрики (стиль KomfortAdmin) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[15px]">
        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            {totalVisits}
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">Визитов за сутки</span>
            <span className="text-[12px] font-semibold text-[#5b6b7a]">100% заходов</span>
          </div>
        </div>

        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            {reachedPhone}
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">Открытий контактов</span>
            <span className="text-[12px] font-semibold text-[#111418]">главный шаг</span>
          </div>
        </div>

        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            {conversionRate} %
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">Конверсия в звонок</span>
            <span className="text-[12px] font-semibold text-[#5b6b7a]">из визита в лид</span>
          </div>
        </div>

        <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
          <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1] text-[#111418]">
            Шаг 1 → 2
          </div>
          <div className="flex items-end justify-between gap-2.5 mt-3">
            <span className="text-[13px] text-[#7a8593] leading-[1.3]">Главная потеря</span>
            <span className="text-[12px] font-semibold text-[#5b6b7a]">-350 отвалов</span>
          </div>
        </div>
      </div>

      {/* Переключатель вкладок (Funnel Tabs как в Komfort Go) */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('steps')}
          className={chipClass(tab === 'steps')}
        >
          Шаги воронки ({steps.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('sessions')}
          className={chipClass(tab === 'sessions')}
        >
          Сессии и глубина ({sessions.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('errors')}
          className={chipClass(tab === 'errors')}
        >
          Детектор спотыканий ({errors.length})
        </button>
      </div>

      {/* 1. ВКЛАДКА: ШАГИ ВОРОНКИ */}
      {tab === 'steps' && (
        <div className="border border-[#ecedf0] rounded-[14px] overflow-hidden bg-white">
          <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-b border-[#f1f2f4]">
            <div>
              <div className="text-[15px] font-semibold text-[#111418]">Сквозная воронка от входа до контакта</div>
              <div className="text-[12.5px] text-[#8a94a0] mt-0.5">
                Каждый шаг измеряется отдельным датчиком без перегрузки сети
              </div>
            </div>
            <div className="text-[12px] text-[#5b6b7a] font-medium bg-[#f3f4f6] px-2.5 py-1 rounded-full">
              Живые замеры
            </div>
          </div>

          <div className="p-5 space-y-4">
            {steps.map((st) => (
              <div key={st.step} className="space-y-1.5">
                <div className="flex items-center justify-between text-[13.5px]">
                  <span className="font-semibold text-[#111418]">{st.label}</span>
                  <div className="flex items-center gap-3">
                    {st.drop_count > 0 && (
                      <span className="text-[12px] text-[#8a94a0]">
                        -{st.drop_count} отвал
                      </span>
                    )}
                    <span className="text-[13.5px] font-bold text-[#111418] tabular-nums">
                      {st.count} чел.
                    </span>
                    <span className="text-[12px] font-semibold text-[#5b6b7a] w-12 text-right tabular-nums">
                      {st.conversion_pct}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-[#f1f2f4] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1f2937] rounded-full transition-all duration-300"
                    style={{ width: `${(st.count / totalVisits) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. ВКЛАДКА: СЕССИИ И ГЛУБИНА */}
      {tab === 'sessions' && (
        <div className="border border-[#ecedf0] rounded-[14px] overflow-hidden bg-white">
          <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-b border-[#f1f2f4]">
            <div>
              <div className="text-[15px] font-semibold text-[#111418]">Последние сессии и поведение</div>
              <div className="text-[12.5px] text-[#8a94a0] mt-0.5">
                Время на сайте, модель устройства, глубина прокрутки и просмотренные квартиры
              </div>
            </div>
            <div className="text-[12.5px] text-[#8a94a0] font-medium bg-[#f3f4f6] px-2.5 py-[3px] rounded-full">
              {sessions.length} визитов
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr>
                  <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                    Сессия
                  </th>
                  <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                    Устройство
                  </th>
                  <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                    Время на сайте
                  </th>
                  <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                    Глубина скролла
                  </th>
                  <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                    Лот открыт
                  </th>
                  <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                    Контакт открыт
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-[#f1f2f4] hover:bg-[#fafbfc] transition-colors"
                  >
                    <td className="px-5 py-[13px]">
                      <div className="font-semibold text-[#111418] text-[13.5px] tabular-nums">
                        {s.id}
                      </div>
                      <div className="text-[12px] text-[#8a94a0]">{s.startedAt}</div>
                    </td>
                    <td className="px-5 py-[13px] text-[#1a1f25] text-[13.5px]">
                      {s.device}
                    </td>
                    <td className="px-5 py-[13px] text-[#111418] font-medium text-[13.5px] tabular-nums">
                      {s.durationFormatted}
                    </td>
                    <td className="px-5 py-[13px] text-[13.5px] tabular-nums text-[#5b6b7a]">
                      {s.scrollDepthPct}% ленты
                    </td>
                    <td className="px-5 py-[13px] text-[13.5px] tabular-nums text-[#111418]">
                      {s.listingsViewedCount} кв.
                    </td>
                    <td className="px-5 py-[13px]">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-[6px] text-[12px] font-semibold ${
                          s.phoneRevealed
                            ? 'bg-[#1f2937] text-white'
                            : 'bg-[#f3f4f6] text-[#8a94a0]'
                        }`}
                      >
                        {s.phoneRevealed ? 'Открыл тел.' : 'Только фото'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. ВКЛАДКА: ДЕТЕКТОР СПОТЫКАНИЙ */}
      {tab === 'errors' && (
        <div className="border border-[#ecedf0] rounded-[14px] overflow-hidden bg-white">
          <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-b border-[#f1f2f4]">
            <div>
              <div className="text-[15px] font-semibold text-[#111418]">Сводка сбоев и спотыканий (Friction Log)</div>
              <div className="text-[12.5px] text-[#8a94a0] mt-0.5">
                Автоматически отлавливает где споткнулся пользователь и где сорвался переход
              </div>
            </div>
            <div className="text-[12.5px] text-[#8a94a0] font-medium bg-[#f3f4f6] px-2.5 py-[3px] rounded-full">
              {errors.length} инцидента
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr>
                  <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                    Сбой / Препятствие
                  </th>
                  <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                    Шаг пути
                  </th>
                  <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                    Задело людей
                  </th>
                  <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                    Повторений
                  </th>
                  <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                    Последний случай
                  </th>
                  <th className="px-5 py-[11px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold text-left">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody>
                {errors.map((err) => (
                  <tr
                    key={err.id}
                    className="border-b border-[#f1f2f4] hover:bg-[#fafbfc] transition-colors"
                  >
                    <td className="px-5 py-[13px] max-w-sm">
                      <div className="font-semibold text-[#111418] text-[13.5px]">
                        {err.message}
                      </div>
                      <div className="text-[12px] text-[#8a94a0]">
                        Источник: {err.source}
                      </div>
                    </td>
                    <td className="px-5 py-[13px] text-[#5b6b7a] text-[13px] whitespace-nowrap">
                      {err.stepName}
                    </td>
                    <td className="px-5 py-[13px] text-[#111418] font-bold text-[13.5px] tabular-nums">
                      {err.peopleCount} чел.
                    </td>
                    <td className="px-5 py-[13px] text-[#5b6b7a] text-[13.5px] tabular-nums">
                      {err.occurrences} раз
                    </td>
                    <td className="px-5 py-[13px] text-[#8a94a0] text-[12px] tabular-nums whitespace-nowrap">
                      {err.lastAt}
                    </td>
                    <td className="px-5 py-[13px] whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-[6px] text-[12px] font-semibold ${
                          err.resolved
                            ? 'bg-[#eef0f2] text-[#111418]'
                            : 'bg-[#1f2937] text-white'
                        }`}
                      >
                        {err.resolved ? 'SVG-защита' : 'В работе'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
