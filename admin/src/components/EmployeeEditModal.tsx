import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { useT } from '../i18n';
import { formatMoney, groupDigits } from '../lib/format';
import { useEmployeeForEdit, useSetEmployeeCredentials, useSetEmployeePermissions, useUpsertEmployeeOverride } from '../data/useStaff';
import { suggestLogin, type Employee, type EmployeeForEdit, type EmployeePermissions } from '../lib/staff';
import { Skeleton } from './Skeleton';

const fieldClass =
  'w-full px-[11px] py-[9px] rounded-[9px] border border-[#e6e8eb] text-[14px] text-[#1a1f25] bg-white focus:outline-none focus:border-[#1f2937]';
const labelClass = 'mb-1 block text-[13px] font-medium text-[#56616e]';

const permissionFields = [
  { key: 'can_price_check', labelKey: 'staff.edit.permission_price_check' },
  { key: 'can_print_labels', labelKey: 'staff.edit.permission_print_labels' },
  { key: 'can_cabinet', labelKey: 'staff.edit.permission_cabinet' },
  // Приёмка: два права, безопасное и опасное, и они идут рядом, чтобы разница
  // читалась сразу. Первое правит карточку товара, второе — остатки в 1С.
  { key: 'can_priemka', labelKey: 'staff.edit.permission_priemka', hintKey: 'staff.edit.permission_priemka_hint' },
  { key: 'can_stock', labelKey: 'staff.edit.permission_stock', warnKey: 'staff.edit.permission_stock_warn' },
  { key: 'can_admin', labelKey: 'staff.edit.permission_admin' },
] as const satisfies ReadonlyArray<{
  key: keyof EmployeePermissions;
  labelKey: string;
  /** Красная строка под названием: право меняет данные в боевой 1С. */
  warnKey?: string;
  /** Обычная подсказка: чем право безопасно. */
  hintKey?: string;
}>;

/** Клавиатура телефона не должна закрывать активное поле — прокрутка после её появления. */
function keepFieldVisible(e: React.FocusEvent<HTMLElement>) {
  const el = e.target;
  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
}

/** «3 000 000» из поля с группировкой → число; пусто → null («брать из 1С»). */
const parseMoney = (s: string): number | null => {
  const digits = s.replace(/\D/g, '');
  return digits ? Number(digits) : null;
};

interface Props {
  employee: Employee;
  onClose: () => void;
}

/**
 * Окно редактирования сотрудника. Поля предзаполнены merge-значениями
 * (ручная правка, если есть, иначе 1С) — их отдаёт RPC get_employee_for_edit.
 * При сохранении поле, совпадающее с 1С, в override не пишется (NULL) и
 * продолжает обновляться толкателем; изменённое — пишется и 1С его не затирает.
 */
export function EmployeeEditModal({ employee, onClose }: Props) {
  const t = useT();
  const { data, error } = useEmployeeForEdit(employee.refKey);

  // Esc закрывает окно.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Справка «как в 1С» — чтобы было видно, что перекрываем.
  const from1c = data
    ? [
        data.base.name,
        data.base.phone,
        data.base.shiftStart ? `${data.base.shiftStart}–${data.base.shiftEnd ?? '…'}` : '',
        data.base.dayRate ? formatMoney(data.base.dayRate) : '',
        data.base.salary ? formatMoney(data.base.salary) : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    // Оверлей: клик мимо окна закрывает. items-end на телефоне (окно снизу, удобно пальцу),
    // по центру с sm. Панель скроллится сама — на маленьком экране ничего не вылезает.
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[calc(100dvh-24px)] w-full max-w-[560px] overflow-y-auto rounded-[14px] border border-[#ecedf0] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#f1f2f4] px-5 py-4">
          <div>
            <div className="text-base font-semibold">{employee.name}</div>
            <div className="mt-0.5 text-[12.5px] text-[#8a94a0]">
              {t('staff.edit.from_1c')}: {from1c || '—'}
            </div>
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

        {data ? (
          <EditForm init={data} onClose={onClose} />
        ) : (
          <div className="flex flex-col gap-3 px-5 py-4">
            {error ? (
              <div className="rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
                {t('common.load_error')} {(error as Error).message}
              </div>
            ) : (
              <>
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Форма правок: состояние инициализируется merge-значениями один раз при загрузке. */
function EditForm({ init, onClose }: { init: EmployeeForEdit; onClose: () => void }) {
  const t = useT();
  const save = useUpsertEmployeeOverride();
  const saveCreds = useSetEmployeeCredentials();
  const savePermissions = useSetEmployeePermissions();

  // Доступ в кабинет. Нет доступа → подсказки по умолчанию: логин = имя
  // латиницей, пароль = цифры телефона (админ может задать свои).
  // Доступ есть → логин и ТЕКУЩИЙ пароль (password_plain, под маской с глазом);
  // у старых строк без plain поле пустое («Пусто — не менять»).
  const hasAccess = init.login != null;
  const [login, setLogin] = useState(
    init.login ?? suggestLogin(init.firstName ?? init.lastName),
  );
  // Пароль в поле НЕ подставляется: сервер его больше не отдаёт и хранит только
  // хэш. Пустое поле означает «не менять»; чтобы выдать новый — надо его набрать
  // или воспользоваться «Сбросить пароль» на странице доступа к PriceChecker.
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [lastName, setLastName] = useState(init.lastName ?? '');
  const [firstName, setFirstName] = useState(init.firstName ?? '');
  const [middleName, setMiddleName] = useState(init.middleName ?? '');
  const [phone, setPhone] = useState(init.phone ?? '');
  const [shiftStart, setShiftStart] = useState(init.shiftStart ?? '');
  const [shiftEnd, setShiftEnd] = useState(init.shiftEnd ?? '');
  const [workDays, setWorkDays] = useState(init.workDaysPerMonth != null ? String(init.workDaysPerMonth) : '');
  const [dayRate, setDayRate] = useState(init.dayRate != null ? groupDigits(String(init.dayRate)) : '');
  const [monthly, setMonthly] = useState(init.monthlySalary != null ? groupDigits(String(init.monthlySalary)) : '');
  const [hidden, setHidden] = useState(init.isHidden);
  const [permissions, setPermissions] = useState(init.permissions);
  // Пока админ не трогал дневную сам — авто-подставляем её из месячной (мягко, можно поправить).
  const dayRateTouched = useRef(init.dayRate != null);

  const suggestedDaily = useMemo(() => {
    const m = parseMoney(monthly);
    const d = workDays ? Number(workDays) : null;
    return m && d && d > 0 ? Math.round(m / d) : null;
  }, [monthly, workDays]);

  /** Месячная/дни изменились → мягкая авто-подсказка дневной (если её не правили руками). */
  function autoFillDaily(nextMonthly: string, nextDays: string) {
    if (dayRateTouched.current) return;
    const m = parseMoney(nextMonthly);
    const d = nextDays ? Number(nextDays) : null;
    setDayRate(m && d && d > 0 ? groupDigits(String(Math.round(m / d))) : '');
  }

  async function handleSave() {
    const b = init.base;
    // Совпало с 1С → NULL (не переопределяем, поле продолжает обновляться из 1С).
    const strDiff = (v: string, base: string | null) => {
      const s = v.trim();
      return s === (base ?? '') ? null : s || null;
    };
    const numDiff = (v: number | null, base: number | null) => (v === base ? null : v);
    // ФИО сравниваем тройкой: перекрываем либо целиком, либо никак —
    // show_name собирается только из override-частей, без подмешивания 1С.
    const fioSame =
      lastName.trim() === (b.lastName ?? '') &&
      firstName.trim() === (b.firstName ?? '') &&
      middleName.trim() === (b.middleName ?? '');
    await save.mutateAsync({
      employeeRef: init.refKey,
      lastName: fioSame ? null : lastName.trim() || null,
      firstName: fioSame ? null : firstName.trim() || null,
      middleName: fioSame ? null : middleName.trim() || null,
      phone: strDiff(phone, b.phone),
      shiftStart: strDiff(shiftStart, b.shiftStart),
      shiftEnd: strDiff(shiftEnd, b.shiftEnd),
      workDaysPerMonth: workDays ? Number(workDays) : null,
      dayRate: numDiff(parseMoney(dayRate), b.dayRate),
      monthlySalary: numDiff(parseMoney(monthly), b.salary),
      isHidden: hidden,
    });
    // Доступ в кабинет. Без доступа подсказки уже в полях — «Сохранить» выдаёт
    // доступ (быстрая выдача, так договорено); пустые логин/пароль не шлём.
    // С доступом: шлём только смену логина и/или НОВЫЙ пароль — совпадающий с
    // текущим (предзаполнен) или стёртый в пусто хеш не трогает.
    const passwordChanged = password.trim() !== '';
    const credsChanged = hasAccess
      ? login.trim().toLowerCase() !== init.login || passwordChanged
      : login.trim() !== '' && password !== '';
    if (credsChanged) {
      await saveCreds.mutateAsync({
        employeeRef: init.refKey,
        login: login.trim(),
        password: hasAccess && !passwordChanged ? '' : password,
      });
    }
    await savePermissions.mutateAsync({ employeeRef: init.refKey, permissions });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <p className="m-0 text-[12.5px] text-[#8a94a0]">{t('staff.edit.empty_note')}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="ov-last">{t('staff.edit.last_name')}</label>
          <input id="ov-last" type="text" value={lastName} onFocus={keepFieldVisible}
            onChange={(e) => setLastName(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ov-first">{t('staff.edit.first_name')}</label>
          <input id="ov-first" type="text" value={firstName} onFocus={keepFieldVisible}
            onChange={(e) => setFirstName(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ov-middle">{t('staff.edit.middle_name')}</label>
          <input id="ov-middle" type="text" value={middleName} onFocus={keepFieldVisible}
            onChange={(e) => setMiddleName(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ov-phone">{t('staff.col.phone')}</label>
          <input id="ov-phone" type="tel" value={phone} onFocus={keepFieldVisible}
            onChange={(e) => setPhone(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ov-shift-start">{t('staff.edit.shift_from')}</label>
          <input id="ov-shift-start" type="time" value={shiftStart} onFocus={keepFieldVisible}
            onChange={(e) => setShiftStart(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ov-shift-end">{t('staff.edit.shift_to')}</label>
          <input id="ov-shift-end" type="time" value={shiftEnd} onFocus={keepFieldVisible}
            onChange={(e) => setShiftEnd(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ov-days">{t('staff.edit.work_days')}</label>
          <input id="ov-days" type="number" min={1} max={31} value={workDays} onFocus={keepFieldVisible}
            onChange={(e) => {
              setWorkDays(e.target.value);
              autoFillDaily(monthly, e.target.value);
            }}
            className={fieldClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="ov-monthly">{t('staff.edit.monthly')}</label>
          <input id="ov-monthly" type="text" inputMode="numeric" value={monthly} onFocus={keepFieldVisible}
            placeholder="3 000 000"
            onChange={(e) => {
              const grouped = groupDigits(e.target.value);
              setMonthly(grouped);
              autoFillDaily(grouped, workDays);
            }}
            className={fieldClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="ov-day-rate">{t('staff.edit.day_rate')}</label>
          <input id="ov-day-rate" type="text" inputMode="numeric" value={dayRate} onFocus={keepFieldVisible}
            onChange={(e) => {
              dayRateTouched.current = e.target.value.trim() !== '';
              setDayRate(groupDigits(e.target.value));
            }}
            className={fieldClass} />
          {suggestedDaily != null && (
            <p className="m-0 mt-1 text-[12.5px] text-[#8a94a0]">
              {t('staff.edit.hint_daily')} ≈ {formatMoney(suggestedDaily)} ({monthly} ÷ {workDays})
            </p>
          )}
        </div>
      </div>

      {/* Доступ в личный кабинет (бот) — отдельным блоком, не смешивая с рабочими данными. */}
      <div className="mt-1 border-t border-[#f1f2f4] pt-3">
        <p className="m-0 mb-2 text-[13px] font-semibold text-[#56616e]">{t('staff.edit.access_section')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ov-login">{t('staff.edit.login')}</label>
            <input id="ov-login" type="text" autoComplete="off" value={login} onFocus={keepFieldVisible}
              onChange={(e) => setLogin(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="ov-password">{t('staff.edit.password')}</label>
            <div className="relative">
              <input id="ov-password" type={showPw ? 'text' : 'password'} autoComplete="new-password"
                value={password} onFocus={keepFieldVisible}
                placeholder={hasAccess ? t('staff.edit.password_keep') : undefined}
                onChange={(e) => setPassword(e.target.value)} className={`${fieldClass} pr-10`} />
              <button
                type="button"
                aria-label={t('staff.edit.password_toggle')}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[7px] p-1.5 text-[#8a94a0] hover:text-[#1a1f25]"
              >
                {showPw ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-1 border-t border-[#f1f2f4] pt-3">
        <p className="m-0 mb-2 text-[13px] font-semibold text-[#56616e]">{t('staff.edit.permissions_section')}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {permissionFields.map((field) => (
            <label key={field.key} className="flex items-start gap-2 text-[13px] text-[#56616e]">
              <input
                type="checkbox"
                className="mt-[3px]"
                checked={permissions[field.key]}
                onChange={(event) =>
                  setPermissions((current) => ({ ...current, [field.key]: event.target.checked }))
                }
              />
              <span>
                {t(field.labelKey)}
                {'warnKey' in field && (
                  <span className="block text-[11.5px] font-semibold text-[#c8332b]">
                    {t(field.warnKey)}
                  </span>
                )}
                {'hintKey' in field && (
                  <span className="block text-[11.5px] text-[#8a94a0]">{t(field.hintKey)}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-[13px] text-[#56616e]">
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
        {t('staff.edit.hide')}
      </label>

      {(save.error ?? saveCreds.error ?? savePermissions.error) && (
        <div className="rounded-[12px] border border-[#f3c9c4] bg-[#fbeae8] px-4 py-3 text-[13px] text-[#c8332b]">
          {t('common.load_error')} {((save.error ?? saveCreds.error ?? savePermissions.error) as Error).message}
        </div>
      )}

      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-[9px] border border-[#e6e8eb] bg-white px-4 py-[9px] text-[13px] font-semibold text-[#56616e]"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          disabled={save.isPending || saveCreds.isPending || savePermissions.isPending}
          onClick={() => void handleSave()}
          className="rounded-[9px] bg-[#1f2937] px-4 py-[9px] text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
