import { useMemo, useState } from 'react';
import {
  addDays,
  resolvePeriod,
  todayTashkent,
  type DateRange,
  type PeriodPreset,
  type ResolvedPeriod,
} from '../lib/period';

export interface UsePeriodResult {
  preset: PeriodPreset;
  custom: DateRange;
  period: ResolvedPeriod;
  setPreset: (preset: PeriodPreset) => void;
  /** Меняет пользовательский диапазон и сразу включает режим «Свой период». */
  handleCustomChange: (range: DateRange) => void;
}

/**
 * Общее состояние переключателя периода (пресет + кастомный диапазон + расчёт
 * текущего/предыдущего диапазонов). Переиспользуется на «Пульсе» и «Кассирах».
 */
export function usePeriod(initialPreset: PeriodPreset = 'last30'): UsePeriodResult {
  const [preset, setPreset] = useState<PeriodPreset>(initialPreset);
  // Стартовый пользовательский диапазон — последние 30 дней (включительно).
  const [custom, setCustom] = useState<DateRange>(() => {
    const today = todayTashkent();
    return { from: addDays(today, -29), to: today };
  });

  const period = useMemo(() => resolvePeriod(preset, custom), [preset, custom]);

  function handleCustomChange(range: DateRange) {
    setCustom(range);
    setPreset('custom');
  }

  return { preset, custom, period, setPreset, handleCustomChange };
}
