import { useT } from '../i18n';

/**
 * Переиспользуемая кнопка «📥 Экспорт» → выгрузка текущих данных экрана в .xlsx.
 * Сама генерация — в обработчике onClick страницы (через lib/xlsx downloadXlsx),
 * чтобы заголовки/колонки были специфичны для каждого экрана. Выгрузка идёт из
 * уже загруженных данных — моментально и работает офлайн.
 */
export function ExcelButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-[7px] rounded-[9px] bg-[#1f2937] px-[15px] py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#111827] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span aria-hidden>📥</span>
      {t('common.export')}
    </button>
  );
}
