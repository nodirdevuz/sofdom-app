import { useT } from '../i18n';
import type { EmployeePermissions } from '../lib/staff';

const badges = [
  {
    key: 'can_price_check',
    shortKey: 'staff.permissions.price_check',
    fullKey: 'staff.edit.permission_price_check',
  },
  {
    key: 'can_print_labels',
    shortKey: 'staff.permissions.print_labels',
    fullKey: 'staff.edit.permission_print_labels',
  },
  {
    key: 'can_cabinet',
    shortKey: 'staff.permissions.cabinet',
    fullKey: 'staff.edit.permission_cabinet',
  },
  {
    key: 'can_priemka',
    shortKey: 'staff.permissions.priemka',
    fullKey: 'staff.edit.permission_priemka',
  },
  {
    key: 'can_stock',
    shortKey: 'staff.permissions.stock',
    fullKey: 'staff.edit.permission_stock',
  },
  {
    key: 'can_admin',
    shortKey: 'staff.permissions.admin',
    fullKey: 'staff.edit.permission_admin',
  },
] as const satisfies ReadonlyArray<{
  key: keyof EmployeePermissions;
  shortKey: string;
  fullKey: string;
}>;

/** Остаток меняет данные в боевой 1С — в списке он должен бросаться в глаза. */
const DANGER_KEYS = new Set<keyof EmployeePermissions>(['can_stock']);

export function EmployeePermissionBadges({ permissions }: { permissions: EmployeePermissions }) {
  const t = useT();
  const enabled = badges.filter(({ key }) => permissions[key]);

  if (enabled.length === 0) {
    return <span className="text-[11px] text-[#8a94a0]">{t('staff.permissions.none')}</span>;
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1" aria-label={t('staff.edit.permissions_section')}>
      {enabled.map(({ key, shortKey, fullKey }) => (
        <span
          key={key}
          title={t(fullKey)}
          aria-label={t(fullKey)}
          className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
            DANGER_KEYS.has(key) ? 'bg-[#fbeae8] text-[#c8332b]' : 'bg-[#eef4ff] text-[#355c9b]'
          }`}
        >
          {t(shortKey)}
        </span>
      ))}
    </span>
  );
}
