import { formatMoney } from '../lib/format';
import type { AttendanceBreak } from '../lib/staff';

/** Ячейка «Отлучки»: готовые строки из RPC («10:45–12:16, 1 соат 30 дақиқа»),
 * каждая с новой строки; ниже — вычет за отлучки, если он есть. */
export function BreaksCell({ breaks, deduction }: { breaks: AttendanceBreak[]; deduction?: number }) {
  if (breaks.length === 0) return <>—</>;
  return (
    <div className="flex flex-col gap-0.5">
      {breaks.map((b, i) => (
        <span key={`${b.from}-${i}`} className="whitespace-nowrap tabular-nums">
          {b.text}
        </span>
      ))}
      {deduction != null && deduction > 0 && (
        <span className="text-[12px] font-semibold text-[#c8332b]">−{formatMoney(deduction)}</span>
      )}
    </div>
  );
}
