import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Smartphone, X } from 'lucide-react';
import { DataTable, type Column } from '../components/DataTable';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { useT } from '../i18n';
import { formatDate } from '../lib/format';
import {
  suggestLoginFor,
  type PricecheckerAccessRow,
  type PricecheckerPermissions,
} from '../lib/pricecheckerAccess';
import {
  useDisableAccess,
  useGrantLogin,
  usePricecheckerAccess,
  useResetPassword,
  useSetAccessPermissions,
  useUnbindDevice,
} from '../data/usePricecheckerAccess';

const controlClass =
  'px-[11px] py-[7px] rounded-[9px] border border-[#e6e8eb] text-[13px] text-[#1a1f25] bg-white focus:outline-none focus:border-[#1f2937]';
const actionClass =
  'rounded-[9px] border border-[#e6e8eb] bg-white px-[10px] py-[6px] text-[12.5px] font-semibold text-[#56616e] hover:border-[#1f2937] hover:text-[#1a1f25] disabled:opacity-50';
const dangerClass =
  'rounded-[9px] border border-[#f3c9c4] bg-white px-[10px] py-[6px] text-[12.5px] font-semibold text-[#c8332b] hover:bg-[#fbeae8] disabled:opacity-50';

/** Пароль, показанный один раз. Дальше его нельзя ни узнать, ни подсмотреть. */
interface ShownPassword {
  name: string;
  login: string;
  password: string;
}

/**
 * «Сотрудники → доступ к PriceChecker»: владелец мышкой раздаёт и отбирает доступ
 * к приложению. Всё, что здесь делается, действует сразу — приложение спрашивает
 * права у сервера на каждый поиск цены и перед каждой печатью.
 */
export default function PricecheckerAccess() {
  const t = useT();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [shown, setShown] = useState<ShownPassword | null>(null);
  const [granting, setGranting] = useState<PricecheckerAccessRow | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const access = usePricecheckerAccess(search, activeOnly);
  const setPermissions = useSetAccessPermissions();
  const resetPassword = useResetPassword();
  const disableAccess = useDisableAccess();
  const unbindDevice = useUnbindDevice();

  const rows = access.data ?? [];
  const withAccess = useMemo(
    () => rows.filter((r) => r.permissions.can_price_check).length,
    [rows],
  );

  function togglePermission(row: PricecheckerAccessRow, key: keyof PricecheckerPermissions) {
    setPermissions.mutate({
      refKey: row.refKey,
      permissions: { ...row.permissions, [key]: !row.permissions[key] },
    });
  }

  async function handleReset(row: PricecheckerAccessRow) {
    const password = await resetPassword.mutateAsync({ refKey: row.refKey, password: null });
    setShown({ name: row.name, login: row.login ?? '', password });
  }

  const permissionCell = (
    row: PricecheckerAccessRow,
    key: keyof PricecheckerPermissions,
    label: string,
  ) => (
    <label className="inline-flex items-center gap-2" title={row.login ? undefined : t('pca.needs_login')}>
      <input
        type="checkbox"
        aria-label={label}
        checked={row.permissions[key]}
        disabled={!row.login || setPermissions.isPending}
        onChange={() => togglePermission(row, key)}
      />
    </label>
  );

  /**
   * Остаток стоит особняком: по нему сотрудник меняет остатки в боевой 1С
   * (списание и инвентаризация), поэтому рядом с галочкой всегда висит
   * напоминание, а у включённого права — красная пометка.
   */
  const stockCell = (row: PricecheckerAccessRow) => (
    <span className="inline-flex items-center gap-2">
      {permissionCell(row, 'can_stock', t('pca.col.stock'))}
      {row.permissions.can_stock ? (
        <StatusBadge tone="neg" label={t('pca.stock_badge')} />
      ) : (
        <span className="text-[11px] text-[#8a94a0]">{t('pca.stock_hint')}</span>
      )}
    </span>
  );

  const columns: Column<PricecheckerAccessRow>[] = [
    {
      key: 'name',
      label: t('pca.col.name'),
      cellClassName: 'font-medium',
      render: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {r.name}
          {!r.isActive && <StatusBadge tone="neu" label={t('staff.status.fired')} />}
        </span>
      ),
    },
    {
      key: 'login',
      label: t('pca.col.login'),
      render: (r) =>
        r.login ? (
          <span className="inline-flex items-center gap-1.5">
            <KeyRound size={13} strokeWidth={2} className="text-[#1b7a3d]" />
            {r.login}
          </span>
        ) : (
          <span className="text-[#8a94a0]">{t('pca.no_login')}</span>
        ),
    },
    { key: 'price', label: t('pca.col.price'), render: (r) => permissionCell(r, 'can_price_check', t('pca.col.price')) },
    { key: 'print', label: t('pca.col.print'), render: (r) => permissionCell(r, 'can_print_labels', t('pca.col.print')) },
    { key: 'cabinet', label: t('pca.col.cabinet'), render: (r) => permissionCell(r, 'can_cabinet', t('pca.col.cabinet')) },
    // Приёмка идёт двумя колонками подряд: сначала безопасная карточка товара,
    // сразу за ней — остаток с красной пометкой. Порядок тот же, что в окне
    // сотрудника, чтобы владелец не искал галочку в разных местах.
    { key: 'priemka', label: t('pca.col.priemka'), render: (r) => permissionCell(r, 'can_priemka', t('pca.col.priemka')) },
    { key: 'stock', label: t('pca.col.stock'), render: stockCell },
    {
      key: 'device',
      label: t('pca.col.device'),
      render: (r) =>
        r.deviceName ? (
          <span className="inline-flex flex-col">
            <span className="inline-flex items-center gap-1.5">
              <Smartphone size={13} strokeWidth={2} className="text-[#56616e]" />
              {r.deviceName}
            </span>
            <span className="text-[12px] text-[#8a94a0]">
              {r.lastSeenAt ? `${t('pca.last_seen')}: ${formatDate(r.lastSeenAt)}` : t('pca.never_seen')}
            </span>
          </span>
        ) : (
          <span className="text-[#8a94a0]">{t('pca.no_device')}</span>
        ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (r) => (
        <span className="inline-flex flex-wrap items-center justify-end gap-2">
          {r.login ? (
            <button type="button" className={actionClass} disabled={resetPassword.isPending} onClick={() => void handleReset(r)}>
              {t('pca.action.reset_password')}
            </button>
          ) : (
            <button type="button" className={actionClass} onClick={() => setGranting(r)}>
              {t('pca.action.grant_login')}
            </button>
          )}
          {r.deviceName && (
            <button type="button" className={actionClass} disabled={unbindDevice.isPending} onClick={() => unbindDevice.mutate(r.refKey)}>
              {t('pca.action.unbind')}
            </button>
          )}
          <button
            type="button"
            className={dangerClass}
            disabled={disableAccess.isPending || !r.login}
            onClick={() => disableAccess.mutate(r.refKey)}
          >
            {t('pca.action.disable')}
          </button>
        </span>
      ),
    },
  ];

  const error = access.error ?? setPermissions.error ?? resetPassword.error ?? disableAccess.error ?? unbindDevice.error;

  return (
    <div className="px-4 py-5 sm:px-6">
      <h1 className="m-0 text-[22px] font-semibold">{t('pca.title')}</h1>
      <p className="m-0 mt-1 text-[13px] text-[#56616e]">{t('pca.subtitle')}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          value={searchInput}
          placeholder={t('pca.search')}
          onChange={(e) => setSearchInput(e.target.value)}
          className={`${controlClass} min-w-[220px]`}
        />
        <label className="flex items-center gap-2 text-[13px] text-[#56616e]">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          {t('pca.active_only')}
        </label>
        <span className="text-[13px] text-[#8a94a0]">
          {t('pca.with_access')}: <b className="text-[#1a1f25]">{withAccess}</b>
        </span>
      </div>

      {error && (
        <div className="mt-4 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {(error as Error).message}
        </div>
      )}

      {access.isLoading ? (
        <div className="mt-6 flex flex-col gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <DataTable
          title={t('pca.table_title')}
          count={rows.length}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.refKey}
          mobileCards
        />
      )}

      {granting && (
        <GrantLoginModal
          row={granting}
          onClose={() => setGranting(null)}
          onGranted={(login, password) => {
            setShown({ name: granting.name, login, password });
            setGranting(null);
          }}
        />
      )}

      {shown && <PasswordOnceModal shown={shown} onClose={() => setShown(null)} />}
    </div>
  );
}

/** Выдача логина: пароль можно задать самому или оставить пустым — сервер придумает. */
function GrantLoginModal({
  row,
  onClose,
  onGranted,
}: {
  row: PricecheckerAccessRow;
  onClose: () => void;
  onGranted: (login: string, password: string) => void;
}) {
  const t = useT();
  const grant = useGrantLogin();
  const [login, setLogin] = useState(suggestLoginFor(row.name));
  const [password, setPassword] = useState('');

  async function submit() {
    const result = await grant.mutateAsync({
      refKey: row.refKey,
      login: login.trim(),
      password: password.trim() || null,
    });
    onGranted(result.login, result.password);
  }

  return (
    <ModalShell title={t('pca.grant.title')} subtitle={row.name} onClose={onClose}>
      <label className="mb-1 block text-[13px] font-medium text-[#56616e]" htmlFor="pca-login">
        {t('pca.grant.login')}
      </label>
      <input
        id="pca-login"
        type="text"
        autoComplete="off"
        value={login}
        onChange={(e) => setLogin(e.target.value)}
        className={`${controlClass} w-full`}
      />

      <label className="mb-1 mt-3 block text-[13px] font-medium text-[#56616e]" htmlFor="pca-password">
        {t('pca.grant.password')}
      </label>
      <input
        id="pca-password"
        type="text"
        autoComplete="off"
        value={password}
        placeholder={t('pca.grant.password_auto')}
        onChange={(e) => setPassword(e.target.value)}
        className={`${controlClass} w-full`}
      />

      {grant.error && (
        <div className="mt-3 rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {(grant.error as Error).message}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={actionClass}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          disabled={grant.isPending || login.trim() === ''}
          onClick={() => void submit()}
          className="rounded-[9px] bg-[#1f2937] px-4 py-[9px] text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {t('pca.grant.submit')}
        </button>
      </div>
    </ModalShell>
  );
}

/** Единственный момент, когда пароль виден. Закрыли окно — узнать его больше негде. */
function PasswordOnceModal({ shown, onClose }: { shown: ShownPassword; onClose: () => void }) {
  const t = useT();
  return (
    <ModalShell title={t('pca.password.title')} subtitle={shown.name} onClose={onClose}>
      <p className="m-0 text-[13px] text-[#56616e]">{t('pca.password.note')}</p>
      <div className="mt-3 rounded-[12px] border border-[#e6e8eb] bg-[#f8f9fa] px-4 py-3">
        <div className="text-[12.5px] text-[#8a94a0]">{t('pca.grant.login')}</div>
        <div className="text-[16px] font-semibold">{shown.login}</div>
        <div className="mt-2 text-[12.5px] text-[#8a94a0]">{t('pca.grant.password')}</div>
        <div className="font-mono text-[20px] font-semibold tracking-wide">{shown.password}</div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-[9px] bg-[#1f2937] px-4 py-[9px] text-[13px] font-semibold text-white"
        >
          {t('pca.password.done')}
        </button>
      </div>
    </ModalShell>
  );
}

/** Общая рамка окна — чтобы два окна страницы не расходились по виду. */
function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[calc(100dvh-24px)] w-full max-w-[460px] overflow-y-auto rounded-[14px] border border-[#ecedf0] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#f1f2f4] px-5 py-4">
          <div>
            <div className="text-base font-semibold">{title}</div>
            <div className="mt-0.5 text-[12.5px] text-[#8a94a0]">{subtitle}</div>
          </div>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
            className="-mr-1 rounded-[7px] p-1.5 text-[#8a94a0] hover:bg-[#f2f3f5] hover:text-[#1a1f25]"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
