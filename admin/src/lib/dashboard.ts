// Производные метрики экрана «Пульс бизнеса».
// Чистые функции: из «сырых» агрегатов RPC считают 6 KPI и дельты к прошлому
// периоду. Деление на ноль (период без продаж) → 0, а не NaN.

import type { Kpi } from '../types';
import type { TFunc } from '../i18n';
import { formatDecimal, formatInt, formatMoney, formatPercent } from './format';

/** «Сырые» агрегаты из RPC get_sales_dashboard (jsonb). */
export interface SalesAggregates {
  /** Выручка = сумма amount по строкам. */
  revenue: number;
  /** Себестоимость = сумма purchase_price * qty. */
  cost: number;
  /** Кол-во строк чеков (для UPT). */
  lines: number;
  /** Кол-во уникальных чеков. */
  receipts: number;
  /** Наличными (на уровне чеков, без дублирования по строкам). */
  cash_total: number;
  /** Картой (на уровне чеков). */
  card_total: number;
  /** Выручка по дням для графика (пропуски заполнены нулями). */
  daily: { d: string; revenue: number }[];
}

/** Шесть KPI «правила 5 секунд». */
export interface DashboardKpis {
  revenue: number;
  grossProfit: number;
  marginPct: number;
  avgCheck: number;
  receipts: number;
  upt: number;
}

/** Считает KPI из агрегатов. Все деления защищены от нуля. */
export function computeKpis(a: SalesAggregates): DashboardKpis {
  const grossProfit = a.revenue - a.cost;
  return {
    revenue: a.revenue,
    grossProfit,
    marginPct: a.revenue > 0 ? (grossProfit / a.revenue) * 100 : 0,
    avgCheck: a.receipts > 0 ? a.revenue / a.receipts : 0,
    receipts: a.receipts,
    upt: a.receipts > 0 ? a.lines / a.receipts : 0,
  };
}

/**
 * Изменение метрики к прошлому периоду. Для всех шести KPI «больше = лучше»,
 * поэтому рост = зелёная стрелка вверх. Если базы для сравнения нет (прошлый
 * период пуст или метрика была 0) — возвращаем undefined, карточка покажется
 * без стрелки, без бессмысленных «∞%».
 */
function delta(cur: number, prev: number | undefined): Kpi['change'] {
  if (prev === undefined || prev === 0) return undefined;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return { text: formatPercent(Math.abs(pct)), up, good: up };
}

/**
 * Собирает массив KPI-карточек (порядок по ТЗ) с дельтами к прошлому периоду.
 * Переводчик t передаётся параметром — функция остаётся чистой и тестируемой.
 */
export function buildKpiCards(
  current: SalesAggregates,
  previous: SalesAggregates | null,
  t: TFunc,
): Kpi[] {
  const c = computeKpis(current);
  const p = previous ? computeKpis(previous) : null;

  return [
    {
      value: formatMoney(c.revenue),
      label: t('dashboard.kpi.revenue'),
      change: delta(c.revenue, p?.revenue),
    },
    {
      value: formatMoney(c.grossProfit),
      label: t('dashboard.kpi.gross_profit'),
      change: delta(c.grossProfit, p?.grossProfit),
    },
    {
      value: formatPercent(c.marginPct),
      label: t('dashboard.kpi.margin'),
      change: delta(c.marginPct, p?.marginPct),
    },
    {
      value: formatMoney(c.avgCheck),
      label: t('dashboard.kpi.avg_check'),
      change: delta(c.avgCheck, p?.avgCheck),
    },
    {
      value: formatInt(c.receipts),
      label: t('dashboard.kpi.receipts'),
      change: delta(c.receipts, p?.receipts),
    },
    {
      value: formatDecimal(c.upt),
      label: t('dashboard.kpi.upt'),
      change: delta(c.upt, p?.upt),
    },
  ];
}
