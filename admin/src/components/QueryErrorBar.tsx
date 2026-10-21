import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useT } from '../i18n';
import {
  clearQueryFailure,
  getQueryFailure,
  subscribeQueryFailure,
  type QueryFailure,
} from '../data/queryErrors';

/**
 * Полоса «не загрузилось» поверх любой страницы админки.
 *
 * Показывает ТЕКСТ ошибки и кнопку «Повторить». Нужна потому, что экран не
 * должен молчать: до 15.09.2026 провалившийся запрос оставлял человека наедине
 * с вечной надписью «Yuklanmoqda…».
 */
export function QueryErrorBar() {
  const t = useT();
  const qc = useQueryClient();
  const [fail, setFail] = useState<QueryFailure | null>(getQueryFailure());
  useEffect(() => subscribeQueryFailure(setFail), []);
  if (!fail) return null;
  return (
    <div
      role="alert"
      className="sticky top-0 z-30 mb-3 flex flex-wrap items-center gap-3 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3"
    >
      <span className="text-[13px] text-[#c8332b]">
        {t('common.load_error')} {fail.message}
      </span>
      <button
        type="button"
        className="rounded-[9px] bg-[#c8332b] px-4 py-1.5 text-[12px] font-medium text-white"
        onClick={() => {
          clearQueryFailure();
          void qc.refetchQueries({ type: 'active' });
        }}
      >
        {t('common.retry')}
      </button>
      <button
        type="button"
        className="ml-auto text-[12px] text-[#8a4a45] underline"
        onClick={clearQueryFailure}
      >
        {t('common.close')}
      </button>
    </div>
  );
}
