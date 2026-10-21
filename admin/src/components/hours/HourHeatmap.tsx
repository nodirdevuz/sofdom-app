import { formatCompact, formatInt, formatMoney } from '../../lib/format';
import { useT } from '../../i18n';
import {
  cellMetric,
  dowShortKey,
  hourLabel,
  hourSortValue,
  type HourCell,
  type HourMetric,
  type SalesByHourOverview,
} from '../../lib/salesByHour';
import { DOW_ORDER } from '../../lib/salesByHour';

interface HourHeatmapProps {
  overview: SalesByHourOverview;
  metric: HourMetric;
}

/** Тепловая карта час × день недели: интенсивность серого = объём по метрике. */
export function HourHeatmap({ overview, metric }: HourHeatmapProps) {
  const t = useT();

  const byKey = new Map<string, HourCell>();
  for (const c of overview.cells) byKey.set(`${c.dow}:${c.hour}`, c);

  // Часы, в которые реально были продажи (полночь — в конец рабочего дня).
  const hours = [...new Set(overview.byHour.map((h) => h.hour))].sort(
    (a, b) => hourSortValue(a) - hourSortValue(b),
  );
  const max = Math.max(1, ...overview.cells.map((c) => cellMetric(c, metric)));

  function cellStyle(value: number): { background: string; color: string } {
    const ratio = value / max;
    return {
      background: `rgba(31, 41, 55, ${(0.04 + 0.88 * ratio).toFixed(3)})`,
      color: ratio > 0.55 ? '#ffffff' : '#3a4654',
    };
  }

  function cellText(value: number): string {
    if (value <= 0) return '';
    return metric === 'revenue' ? formatCompact(value) : formatInt(value);
  }

  function cellTitle(cell: HourCell | undefined, dow: number, hour: number): string {
    const day = t(dowShortKey(dow));
    if (!cell) return `${day} ${hourLabel(hour)}`;
    return `${day} ${hourLabel(hour)} · ${formatMoney(cell.revenue)} · ${formatInt(cell.receipts)}`;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] border-separate border-spacing-[3px]">
        <thead>
          <tr>
            <th className="w-[52px]" />
            {DOW_ORDER.map((dow) => (
              <th
                key={dow}
                className="pb-1 text-center text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#94a0ac]"
              >
                {t(dowShortKey(dow))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((hour) => (
            <tr key={hour}>
              <td className="pr-1 text-right text-[11.5px] font-medium tabular-nums text-[#8a94a0] whitespace-nowrap">
                {hourLabel(hour)}
              </td>
              {DOW_ORDER.map((dow) => {
                const cell = byKey.get(`${dow}:${hour}`);
                const value = cellMetric(cell, metric);
                const { background, color } = cellStyle(value);
                return (
                  <td
                    key={dow}
                    title={cellTitle(cell, dow, hour)}
                    style={{ background, color }}
                    className="h-[30px] rounded-[5px] text-center text-[11px] font-semibold tabular-nums"
                  >
                    {cellText(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
