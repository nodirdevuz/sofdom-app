import type { AbcGroup } from '../../lib/abc';

/** Фон/текст бейджа группы: A зелёный, B жёлтый, C серый (нейтральный хвост). */
const GROUP_TONE: Record<AbcGroup, string> = {
  A: 'bg-[#e7f5ec] text-[#1b7a3d]',
  B: 'bg-[#fdf3d6] text-[#9a7211]',
  C: 'bg-[#eef0f2] text-[#5a6675]',
};

/** Акцентный цвет группы (полоса/точка на карточках сводки). */
export const GROUP_ACCENT: Record<AbcGroup, string> = {
  A: '#1b7a3d',
  B: '#c79214',
  C: '#8a94a0',
};

/** Круглый бейдж с буквой группы (A/B/C). */
export function AbcBadge({ group }: { group: AbcGroup }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12.5px] font-bold ${GROUP_TONE[group]}`}
    >
      {group}
    </span>
  );
}
