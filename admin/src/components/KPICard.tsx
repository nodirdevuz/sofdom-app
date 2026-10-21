import type { Kpi } from '../types';

export function KPICard({ kpi }: { kpi: Kpi }) {
  return (
    <div className="bg-[#f7f8f9] border border-[#ecedf0] rounded-[14px] px-5 py-[18px]">
      <div className="text-[29px] font-bold tracking-[-0.02em] tabular-nums leading-[1.1]">
        {kpi.value}
      </div>
      <div className="flex items-end justify-between gap-2.5 mt-3">
        <span className="text-[13px] text-[#7a8593] leading-[1.3]">{kpi.label}</span>
        {kpi.change && (
          <span
            className="text-[13px] font-semibold whitespace-nowrap"
            style={{ color: kpi.change.good ? '#1b7a3d' : '#c8332b' }}
          >
            {kpi.change.up ? '↑' : '↓'} {kpi.change.text}
          </span>
        )}
      </div>
    </div>
  );
}
