import type { StatusTone } from '../types';

/** Цвета pill-бейджа по тону — палитра из исходного дизайна. */
const TONE_CLASS: Record<StatusTone, string> = {
  pos: 'bg-[#e7f5ec] text-[#1b7a3d]',
  neu: 'bg-[#eef0f2] text-[#5a6675]',
  neg: 'bg-[#fbeae8] text-[#c8332b]',
  dark: 'bg-[#1f2937] text-white',
};

interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
}

export function StatusBadge({ tone, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-[11px] py-1 rounded-full text-[12.5px] font-semibold ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}
