import type { DateRange, PeriodPreset } from '../../lib/period';
import type { TranslationKey } from '../../i18n/dictionaries/ru';
import { useT } from '../../i18n';

interface PeriodSwitcherProps {
  preset: PeriodPreset;
  /** Текущий пользовательский диапазон (для режима «Свой период»). */
  custom: DateRange;
  onPresetChange: (preset: PeriodPreset) => void;
  onCustomChange: (range: DateRange) => void;
  /** Какие пресеты показать и в каком порядке. По умолчанию — набор «Пульса». */
  presets?: PeriodPreset[];
}

const PRESET_LABEL: Record<PeriodPreset, TranslationKey> = {
  today: 'period.today',
  yesterday: 'period.yesterday',
  last7: 'period.last7_short',
  last30: 'period.last30_short',
  last60: 'period.last60_short',
  last90: 'period.last90_short',
  last365: 'period.last365_short',
  custom: 'period.custom',
};

const DEFAULT_PRESETS: PeriodPreset[] = ['today', 'yesterday', 'last7', 'last30', 'custom'];

function chipClass(active: boolean): string {
  return [
    'px-[14px] py-[7px] rounded-[9px] text-[13px] font-semibold whitespace-nowrap transition-colors border',
    active
      ? 'bg-[#1f2937] text-white border-[#1f2937]'
      : 'bg-white text-[#56616e] border-[#e6e8eb] hover:bg-[#f7f8f9]',
  ].join(' ');
}

const dateInputClass =
  'px-[11px] py-[7px] rounded-[9px] border border-[#e6e8eb] text-[13px] text-[#1a1f25] bg-white focus:outline-none focus:border-[#1f2937]';

/** Переключатель периода: пресеты + диапазон дат для режима «Свой период». */
export function PeriodSwitcher({
  preset,
  custom,
  onPresetChange,
  onCustomChange,
  presets = DEFAULT_PRESETS,
}: PeriodSwitcherProps) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onPresetChange(value)}
            className={chipClass(preset === value)}
          >
            {t(PRESET_LABEL[value])}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#8a94a0]">
          <span>{t('period.from')}</span>
          <input
            type="date"
            value={custom.from}
            max={custom.to}
            onChange={(e) => onCustomChange({ ...custom, from: e.target.value })}
            className={dateInputClass}
          />
          <span>{t('period.to')}</span>
          <input
            type="date"
            value={custom.to}
            min={custom.from}
            onChange={(e) => onCustomChange({ ...custom, to: e.target.value })}
            className={dateInputClass}
          />
        </div>
      )}
    </div>
  );
}
