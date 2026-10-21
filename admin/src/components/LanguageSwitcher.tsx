import { useLang, type Lang } from '../i18n';

const OPTIONS: { value: Lang; label: string }[] = [
  { value: 'ru', label: 'РУ' },
  { value: 'uz', label: 'UZ' },
];

/** Сегментированный переключатель языка РУ | UZ (мгновенное переключение). */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useLang();

  return (
    <div
      role="group"
      aria-label={t('sidebar.lang_aria')}
      className="inline-flex gap-0.5 rounded-[9px] bg-[#f2f3f5] p-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = lang === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => setLang(opt.value)}
            className={`rounded-[7px] px-3 py-1 text-[12.5px] font-semibold transition-colors ${
              active
                ? 'bg-white text-[#1a1f25] shadow-sm'
                : 'text-[#8a94a0] hover:text-[#5b6b7a]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
