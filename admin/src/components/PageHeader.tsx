interface PageHeaderProps {
  title: string;
  subtitle: string;
  onExport?: () => void;
}

export function PageHeader({ title, subtitle, onExport }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5 mb-2">
      <div className="min-w-0">
        <h1 className="m-0 text-[22px] sm:text-[25px] font-extrabold tracking-tight text-[#0f172a]">{title}</h1>
        <p className="mt-1 mb-0 text-sm text-[#64748b]">{subtitle}</p>
      </div>
      <div className="flex items-center flex-wrap gap-2.5 shrink-0">
        <div className="flex items-center gap-2 px-3.5 py-2 border border-[#e2e8f0] rounded-xl text-xs text-[#64748b] font-semibold bg-white shadow-sm">
          <span>📅</span> Томск, 2026
        </div>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
          >
            <span>📥</span> Экспорт
          </button>
        )}
      </div>
    </header>
  );
}
