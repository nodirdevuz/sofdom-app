import { Plus, RotateCcw, X } from 'lucide-react';
import { useT } from '../../i18n';
import { groupDigits } from '../../lib/format';
import { DEFAULT_BOUNDS, boundsAreValid } from '../../lib/segments';

interface SegmentBoundsProps {
  bounds: number[];
  onChange: (bounds: number[]) => void;
}

/**
 * Границы сегментов, которые владелец задаёт сам.
 *
 * 🔴 ЗАЧЕМ ОТДЕЛЬНЫЙ КОМПОНЕНТ, А НЕ КУСОК СТРАНИЦЫ. Тот же набор границ нужен MCP-инструменту и
 * понадобится соседним отчётам; правило проекта — повторяющийся элемент живёт в ОДНОМ месте,
 * страницы только подключают.
 *
 * Границы — это «стенки» между сегментами: {10 000, 50 000} задают три сегмента — до 10 000,
 * 10 000–50 000 и от 50 000. Поэтому границ всегда на одну меньше, чем сегментов, и хотя бы одна
 * обязана быть: без границ делить нечего.
 */
export function SegmentBounds({ bounds, onChange }: SegmentBoundsProps) {
  const t = useT();
  const valid = boundsAreValid(bounds);

  function setAt(index: number, raw: string) {
    const digits = raw.replace(/\D/g, '');
    const next = [...bounds];
    next[index] = digits === '' ? 0 : Number(digits);
    onChange(next);
  }

  function removeSegment(index: number) {
    if (bounds.length <= 1) return;
    const boundary = index === bounds.length ? bounds.length - 1 : index;
    onChange(bounds.filter((_, i) => i !== boundary));
  }

  function addOne() {
    // Новая граница — вдвое выше последней: так она заведомо больше предыдущей, и владельцу не
    // приходится сначала чинить порядок, а потом вводить число.
    const last = bounds[bounds.length - 1] ?? 10_000;
    onChange([...bounds, last * 2]);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-[#8a94a0]">{t('segments.bounds_label')}</span>
      <div className="flex flex-wrap items-end gap-2">
        {Array.from({ length: bounds.length + 1 }).map((_, i) => (
          <div
            key={i}
            className="flex items-end gap-2 rounded-[10px] border border-[#e6e8eb] bg-white p-2"
          >
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#94a0ac]">
              {t('segments.bounds_from')}
              {i === 0 ? (
                <span className="w-[96px] rounded-[7px] bg-[#f7f8f9] px-2 py-[6px] text-right text-[13px] font-normal normal-case text-[#9aa4b0]">
                  {t('segments.bounds_open')}
                </span>
              ) : (
                <input
                  value={bounds[i - 1] ? groupDigits(String(bounds[i - 1])) : ''}
                  onChange={(e) => setAt(i - 1, e.target.value)}
                  inputMode="numeric"
                  className="w-[96px] rounded-[7px] border border-[#e6e8eb] px-2 py-[5px] text-right text-[13px] font-normal tabular-nums text-[#1a1f25] outline-none focus:border-[#1f2937]"
                />
              )}
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#94a0ac]">
              {t('segments.bounds_to')}
              {i === bounds.length ? (
                <span className="w-[96px] rounded-[7px] bg-[#f7f8f9] px-2 py-[6px] text-right text-[13px] font-normal normal-case text-[#9aa4b0]">
                  {t('segments.bounds_open')}
                </span>
              ) : (
                <input
                  value={bounds[i] ? groupDigits(String(bounds[i])) : ''}
                  onChange={(e) => setAt(i, e.target.value)}
                  inputMode="numeric"
                  className="w-[96px] rounded-[7px] border border-[#e6e8eb] px-2 py-[5px] text-right text-[13px] font-normal tabular-nums text-[#1a1f25] outline-none focus:border-[#1f2937]"
                />
              )}
            </label>
            {bounds.length > 1 && (
              <button
                type="button"
                onClick={() => removeSegment(i)}
                aria-label={t('segments.bounds_remove')}
                title={t('segments.bounds_remove')}
                className="mb-[1px] rounded-[7px] p-[6px] text-[#9aa4b0] transition-colors hover:bg-[#f3f4f6] hover:text-[#56616e]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addOne}
          className="flex items-center gap-1.5 rounded-[9px] border border-[#e6e8eb] bg-white px-3 py-[7px] text-[13px] font-semibold text-[#56616e] transition-colors hover:bg-[#f7f8f9]"
        >
          <Plus size={14} /> {t('segments.bounds_add')}
        </button>

        <button
          type="button"
          onClick={() => onChange(DEFAULT_BOUNDS)}
          className="flex items-center gap-1.5 rounded-[9px] border border-transparent px-2 py-[7px] text-[13px] font-medium text-[#8a94a0] transition-colors hover:text-[#56616e]"
        >
          <RotateCcw size={13} /> {t('segments.bounds_reset')}
        </button>
      </div>

      {/* Пока границы негодные, запрос не уходит вовсе (см. useSegments) — и человек должен
          понимать почему, иначе экран выглядит просто застывшим. */}
      {!valid && (
        <p className="m-0 rounded-[10px] border border-[#f0e2c4] bg-[#fdf7ec] px-3 py-2 text-[12.5px] text-[#8a6b25]">
          {t('segments.bounds_invalid')}
        </p>
      )}
    </div>
  );
}
