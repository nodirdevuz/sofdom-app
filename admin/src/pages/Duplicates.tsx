import { PageHeader } from '../components/PageHeader';
import { useDuplicates, type DuplicateGroup } from '../data/useDuplicates';
import { formatInt, formatMoney } from '../lib/format';
import { downloadXlsx, todayStamp } from '../lib/xlsx';
import { useT } from '../i18n';
import type { TranslationKey } from '../i18n/dictionaries/ru';
import type { DuplicateDecision } from '../types';

const money = (v: number | null) => (v === null ? '—' : formatMoney(v));

const HEADERS: { labelKey: TranslationKey; align: 'left' | 'right' }[] = [
  { labelKey: 'duplicates.col.name_file', align: 'left' },
  { labelKey: 'products.col.purchase', align: 'right' },
  { labelKey: 'products.col.sale', align: 'right' },
  { labelKey: 'products.col.stock', align: 'right' },
];

interface GroupCardProps {
  group: DuplicateGroup;
  saving: boolean;
  onDecide: (decision: DuplicateDecision) => void;
}

function GroupCard({ group, saving, onDecide }: GroupCardProps) {
  const t = useT();
  return (
    <div className="border border-[#ecedf0] rounded-[14px] overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-2.5 px-5 py-4 border-b border-[#f1f2f4]">
        <div className="text-sm font-semibold text-[#1a1f25] break-words">{group.name_clean}</div>
        <div className="text-[12.5px] text-[#8a94a0] font-medium bg-[#f3f4f6] px-2.5 py-[3px] rounded-full shrink-0">
          {t('duplicates.rows', { count: group.members.length })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[560px]">
          <thead>
            <tr>
              {HEADERS.map((h) => (
                <th
                  key={h.labelKey}
                  className={`px-5 py-[10px] bg-[#fafbfc] border-b border-[#eceef0] text-[11.5px] uppercase tracking-[0.04em] text-[#94a0ac] font-semibold whitespace-nowrap ${
                    h.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {t(h.labelKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.members.map((m, idx) => (
              <tr key={`${m.row_number}-${idx}`} className="transition-colors hover:bg-[#fafbfc]">
                <td className="px-5 py-[12px] border-b border-[#f3f4f6] text-sm text-[#1a1f25] font-medium">
                  {m.name}
                </td>
                <td className="px-5 py-[12px] border-b border-[#f3f4f6] text-sm text-right tabular-nums whitespace-nowrap text-[#3a4654]">
                  {money(m.purchase_price)}
                </td>
                <td className="px-5 py-[12px] border-b border-[#f3f4f6] text-sm text-right tabular-nums whitespace-nowrap text-[#3a4654]">
                  {money(m.sale_price)}
                </td>
                <td className="px-5 py-[12px] border-b border-[#f3f4f6] text-sm text-right tabular-nums whitespace-nowrap text-[#3a4654]">
                  {formatInt(m.stock)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-t border-[#f1f2f4]">
        <button
          type="button"
          disabled={saving}
          onClick={() => onDecide('same')}
          className="px-3.5 py-2 rounded-[9px] text-[13.5px] font-semibold bg-[#1f2937] text-white transition-colors hover:bg-[#111827] disabled:opacity-50"
        >
          {t('duplicates.same')}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onDecide('different')}
          className="px-3.5 py-2 rounded-[9px] text-[13.5px] font-semibold border border-[#e6e8eb] text-[#56616e] bg-white transition-colors hover:bg-[#f2f3f5] disabled:opacity-50"
        >
          {t('duplicates.different')}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onDecide('rename')}
          className="px-3.5 py-2 rounded-[9px] text-[13.5px] font-semibold border border-[#e6e8eb] text-[#56616e] bg-white transition-colors hover:bg-[#f2f3f5] disabled:opacity-50"
        >
          {t('duplicates.rename')}
        </button>
        {saving && <span className="text-[13px] text-[#8a94a0]">{t('duplicates.saving')}</span>}
      </div>
    </div>
  );
}

export default function Duplicates() {
  const t = useT();
  const { groups, isLoading, error, savingKey, saveDecision } = useDuplicates();

  // Экспорт текущих (неразмеченных) групп в .xlsx: по строке на каждый член группы.
  // Колонка «Группа» убрана (дублировала название); вместо неё — размер группы.
  function handleExport() {
    const rows = groups.flatMap((g) =>
      g.members.map((m) => [m.name, m.purchase_price, m.sale_price, m.stock, g.members.length]),
    );
    downloadXlsx(
      `dubli_${todayStamp()}.xlsx`,
      [
        { header: t('products.col.name'), width: 44 },
        { header: t('products.col.purchase'), width: 14 },
        { header: t('products.col.sale'), width: 14 },
        { header: t('products.col.stock'), width: 12 },
        { header: t('duplicates.col.rows_in_group'), width: 16 },
      ],
      rows,
      t('nav.duplicates'),
    );
  }

  return (
    <>
      <PageHeader
        title={t('nav.duplicates')}
        subtitle={t('duplicates.subtitle')}
        onExport={handleExport}
      />

      <div className="mt-[22px]">
        {error ? (
          <div className="border border-[#ecedf0] rounded-[14px] bg-white px-5 py-12 text-center text-sm text-[#c8332b]">
            {t('common.load_error')} {error}
          </div>
        ) : isLoading ? (
          <div className="border border-[#ecedf0] rounded-[14px] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
            {t('common.loading')}
          </div>
        ) : groups.length === 0 ? (
          <div className="border border-[#ecedf0] rounded-[14px] bg-white px-5 py-12 text-center text-sm text-[#8a94a0]">
            {t('duplicates.empty')}
          </div>
        ) : (
          <>
            <div className="mb-3 text-[13px] text-[#8a94a0]">
              {t('duplicates.to_review', { count: groups.length })}
            </div>
            <div className="flex flex-col gap-4">
              {groups.map((g) => (
                <GroupCard
                  key={g.name_clean}
                  group={g}
                  saving={savingKey === g.name_clean}
                  onDecide={(decision) => saveDecision(g.name_clean, decision)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
