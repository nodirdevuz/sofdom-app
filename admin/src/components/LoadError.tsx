import { useT } from '../i18n';

/**
 * Одна плашка ошибки загрузки на всю админку — с текстом и кнопкой «Повторить».
 *
 * ЗАЧЕМ. 15.09.2026 экран «Сотрудники» висел на «Yuklanmoqda…» бесконечно: ни
 * списка, ни ошибки. Разбор показал, что так устроена половина экранов —
 * условие вида `isLoading || !data` рисует скелетон и при ПРОВАЛЕ запроса,
 * потому что при ошибке данных нет. Человек видит вечную загрузку и не может
 * даже понять, что сломалось и стоит ли ждать.
 *
 * Правило теперь простое: нет данных и есть ошибка — показываем ошибку и даём
 * нажать «Повторить», а не крутим загрузку. Текст ошибки виден на экране, а не
 * только в консоли: у полки консоль никто не открывает.
 */
export function LoadError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT();
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    <div
      role="alert"
      className="rounded-[14px] border border-[#f3c9c4] bg-[#fbeae8] px-5 py-6 text-center"
    >
      <div className="text-[14px] font-medium text-[#c8332b]">{t('common.load_error')}</div>
      {message && <div className="mt-2 break-words text-[13px] text-[#8a4a45]">{message}</div>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-[10px] bg-[#c8332b] px-5 py-2 text-[13px] font-medium text-white"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
