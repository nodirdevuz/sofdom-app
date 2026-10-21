import { Download } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  onExport?: () => void;
}

export function PageHeader({ title, subtitle, onExport }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5 mb-5">
      <div className="min-w-0">
        <h1 className="m-0 text-[22px] sm:text-[25px] font-bold tracking-[-0.02em] text-[#111418]">
          {title}
        </h1>
        <p className="mt-[5px] mb-0 text-sm text-[#8a94a0]">{subtitle}</p>
      </div>

      <div className="flex items-center flex-wrap gap-2.5 shrink-0">
        <div className="flex items-center gap-2 px-[13px] py-2 border border-[#e6e8eb] rounded-[9px] text-[13px] text-[#56616e] font-medium whitespace-nowrap bg-white">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1f2937]" />
          Томск • Live
        </div>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-[7px] px-[15px] py-2 bg-[#1f2937] text-white rounded-[9px] text-[13.5px] font-semibold whitespace-nowrap transition-colors hover:bg-[#111827]"
          >
            <Download size={14} />
            <span>Экспорт</span>
          </button>
        )}
      </div>
    </header>
  );
}
