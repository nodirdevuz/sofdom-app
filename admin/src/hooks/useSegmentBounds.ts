import { useEffect, useState } from 'react';
import { BOUNDS_STORAGE_KEY, DEFAULT_BOUNDS, boundsAreValid } from '../lib/segments';

/** Прочитать сохранённые границы. Ничего не сохранено или сохранён мусор — берём умолчание. */
function loadBounds(): number[] {
  try {
    const raw = localStorage.getItem(BOUNDS_STORAGE_KEY);
    if (!raw) return DEFAULT_BOUNDS;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const nums = parsed.map((x) => Number(x));
      if (boundsAreValid(nums)) return nums;
    }
  } catch {
    // Хранилище недоступно (приватное окно, запрет на данные сайта) или в нём мусор — это не
    // повод ломать экран: просто начнём с умолчания.
  }
  return DEFAULT_BOUNDS;
}

export interface UseSegmentBoundsResult {
  bounds: number[];
  setBounds: (bounds: number[]) => void;
  /** Границы годны для запроса: строго возрастают и больше нуля. */
  valid: boolean;
}

/**
 * Границы сегментов, которые владелец задаёт сам, и их сохранение между заходами.
 *
 * Отдельным хуком, а не куском страницы: работа с localStorage — забота браузера, а lib/segments.ts
 * обязан остаться чистым, иначе его нельзя прогнать проверкой под Node.
 *
 * Негодные границы НЕ сохраняются: иначе владелец, случайно стерев цифру, вернулся бы завтра на
 * сломанный экран и не понял почему.
 */
export function useSegmentBounds(): UseSegmentBoundsResult {
  const [bounds, setBounds] = useState<number[]>(() => loadBounds());
  const valid = boundsAreValid(bounds);

  useEffect(() => {
    if (!valid) return;
    try {
      localStorage.setItem(BOUNDS_STORAGE_KEY, JSON.stringify(bounds));
    } catch {
      // Не сохранилось — экран всё равно работает, границы просто не переживут перезагрузку.
    }
  }, [bounds, valid]);

  return { bounds, setBounds, valid };
}
