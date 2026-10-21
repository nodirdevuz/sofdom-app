import { useEffect, useRef, useState } from 'react';
import { groupDigits, evalSum } from '../../lib/format';
import { useT } from '../../i18n';

/**
 * Поле ввода суммы: показывает с пробелами («100 000»), хранит число.
 * Калькулятор НЕ всплывает сам — открывается только по клику на иконку.
 * «500000 + 100000» → Enter вставит сумму. Переиспользуется для нал и безнал.
 */
export function AmountInput({
  value,
  onChange,
  className = '',
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const display = value == null ? '' : groupDigits(String(value));

  // Закрытие калькулятора по клику вне и по Esc.
  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggleCalc() {
    setOpen((o) => {
      if (!o) setExpr(value == null ? '' : String(value));
      return !o;
    });
  }

  function applyCalc() {
    onChange(evalSum(expr));
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative inline-block">
      <input
        inputMode="numeric"
        className={`rounded-[8px] border border-[#dfe2e7] py-1.5 pl-3 pr-8 text-right text-sm tabular-nums outline-none focus:border-[#1a8a4a] ${className}`}
        placeholder="0"
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          onChange(digits === '' ? null : Number(digits));
        }}
      />
      <button
        type="button"
        aria-label={t('recon.calc.title')}
        title={t('recon.calc.title')}
        onClick={toggleCalc}
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[6px] p-1 transition-colors ${
          open ? 'text-[#1a8a4a]' : 'text-[#9aa4b0] hover:text-[#3a4654]'
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="8" y1="10" x2="8" y2="10" />
          <line x1="12" y1="10" x2="12" y2="10" />
          <line x1="16" y1="10" x2="16" y2="10" />
          <line x1="8" y1="14" x2="8" y2="14" />
          <line x1="12" y1="14" x2="12" y2="14" />
          <line x1="16" y1="14" x2="16" y2="18" />
          <line x1="8" y1="18" x2="12" y2="18" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-[210px] rounded-[10px] border border-[#e3e6ea] bg-white p-2.5 shadow-[0_8px_28px_rgba(20,28,40,0.14)]">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#94a0ac]">
            {t('recon.calc.title')}
          </div>
          <input
            autoFocus
            inputMode="numeric"
            className="w-full rounded-[7px] border border-[#dfe2e7] px-2.5 py-1.5 text-right text-sm tabular-nums outline-none focus:border-[#1a8a4a]"
            placeholder="500000 + 100000"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyCalc();
              }
            }}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[12px] tabular-nums text-[#3a4654]">
              = {groupDigits(String(evalSum(expr) ?? 0))}
            </span>
            <button
              type="button"
              className="rounded-[7px] bg-[#1a1f25] px-2.5 py-1 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              onClick={applyCalc}
            >
              {t('recon.calc.apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
