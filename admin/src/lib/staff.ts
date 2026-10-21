// Чистая логика раздела «Сотрудники»: типы + нормализация ответов RPC (jsonb → TS).
// Без побочных эффектов (по образцу lib/expenses.ts / lib/suppliers.ts).

/** Данные сотрудника как пришли из 1С (для подсказок в окне редактирования). */
export interface EmployeeBase {
  name: string;
  phone: string;
  dayRate: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  salary: number | null;
}

/** Ручные правки из админки (null = поле не переопределено, действует 1С). */
export interface EmployeeOverride {
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  phone: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  workDaysPerMonth: number | null;
  dayRate: number | null;
  monthlySalary: number | null;
}

export interface EmployeePermissions {
  can_price_check: boolean;
  can_print_labels: boolean;
  can_cabinet: boolean;
  can_admin: boolean;
  /** Отправка остатка из приёмки — по нему меняются остатки в боевой 1С. */
  can_stock: boolean;
  /** Правка карточки товара в приёмке: категория, бренд, параметр. Остатков не трогает. */
  can_priemka: boolean;
}

export interface Employee {
  refKey: string;
  code: string;
  /** Merged-значения: override, если задан, иначе 1С. */
  name: string;
  phone: string;
  jobTitle: string;
  department: string;
  hiredAt: string | null;
  balance: number;
  totalReceived: number;
  totalCredited: number;
  isActive: boolean;
  isHidden: boolean;
  /** Выдан ли логин/пароль кабинета (строка в employee_auth). */
  hasAccess: boolean;
  permissions: EmployeePermissions;
  dayRate: number | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  workDaysPerMonth: number | null;
  monthlySalary: number | null;
  base: EmployeeBase;
  override: EmployeeOverride;
}

/** Данные для окна редактирования (RPC get_employee_for_edit): merge-значения
 * для показа в полях + base (как в 1С) для сравнения при сохранении. */
export interface EmployeeForEdit {
  refKey: string;
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
  phone: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  workDaysPerMonth: number | null;
  dayRate: number | null;
  monthlySalary: number | null;
  isHidden: boolean;
  /** Логин кабинета; null = доступ ещё не выдан. */
  login: string | null;
  /** Открытый пароль для показа админу (null у строк, выданных до этой фичи). */
  /**
   * Всегда null: пароли открытым текстом больше не хранятся и сервером не
   * отдаются. Поле оставлено, чтобы старые сборки админки не падали на
   * отсутствующем ключе; читать его незачем.
   */
  passwordPlain: null;
  permissions: EmployeePermissions;
  base: {
    name: string;
    lastName: string | null;
    firstName: string | null;
    middleName: string | null;
    phone: string | null;
    shiftStart: string | null;
    shiftEnd: string | null;
    dayRate: number | null;
    salary: number | null;
  };
}

/** Отлучка внутри дня; text — готовая строка из RPC («10:45–12:16, 1 соат 30 дақиқа»). */
export interface AttendanceBreak {
  from: string;
  to: string;
  minutes: number;
  text: string;
}

/** Строка табеля: одна на сотрудника за день (агрегирует attendance_day_calc). */
export interface AttendanceRow {
  id: number;
  date: string;
  employeeRef: string;
  employeeName: string;
  cameAt: string | null;
  leftAt: string | null;
  /** Ещё на месте (уход не отмечен). */
  onSite: boolean;
  wasLate: boolean;
  lateHours: number;
  /** Готовые строки длительностей из RPC («53 дақиқа»). */
  lateText: string;
  breaks: AttendanceBreak[];
  breaksCount: number;
  breakMinutes: number;
  breakText: string;
  /** Деньги дня: ставка − вычет опоздания − вычет отлучки − штраф 1С = заработок. */
  rate: number;
  lateDeduction: number;
  breakDeduction: number;
  earned: number;
  fine: number;
}

export interface AttendancePage {
  totalCount: number;
  rows: AttendanceRow[];
}

export interface AttendanceSummaryRow {
  employeeRef: string;
  employeeName: string;
  days: number;
  lates: number;
  fines: number;
  breaksTotalMinutes: number;
  deductionsTotal: number;
}

/** Статус явки за день (считает RPC get_attendance_day). */
export type AttendanceDayStatus = 'absent' | 'late' | 'on_site' | 'left';

export interface AttendanceDayRow {
  employeeRef: string;
  employeeName: string;
  cameAt: string | null;
  leftAt: string | null;
  wasLate: boolean;
  lateHours: number;
  lateText: string;
  breaks: AttendanceBreak[];
  breaksCount: number;
  breakMinutes: number;
  breakText: string;
  fine: number;
  status: AttendanceDayStatus;
}

export interface AttendanceDaySummary {
  cameCount: number;
  lateCount: number;
  finesTotal: number;
}

export interface StaffPurchaseRow {
  id: number;
  date: string;
  employeeName: string;
  productName: string;
  qty: number;
  amount: number;
}

export interface StaffPurchasesPage {
  totalCount: number;
  totalAmount: number;
  byEmployee: { employeeRef: string; employeeName: string; amount: number; count: number }[];
  rows: StaffPurchaseRow[];
}

// Транслит для подсказки логина (рус/узб кириллица → латиница).
const CYR_TO_LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh',
  ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

/** Подсказка логина: имя латиницей в нижнем регистре (только [a-z0-9]). */
export function suggestLogin(name: string | null): string {
  return (name ?? '')
    .toLowerCase()
    .split('')
    .map((ch) => CYR_TO_LAT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

const obj = (x: unknown): Record<string, unknown> => (x ?? {}) as Record<string, unknown>;
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

const numOrNull = (x: unknown): number | null => (x == null ? null : Number(x));
const strOrNull = (x: unknown): string | null => (x == null ? null : String(x));

const normalizePermissions = (value: unknown): EmployeePermissions => {
  const permissions = obj(value);
  return {
    can_price_check: permissions.can_price_check === true,
    can_print_labels: permissions.can_print_labels === true,
    can_cabinet: permissions.can_cabinet === true,
    can_admin: permissions.can_admin === true,
    can_stock: permissions.can_stock === true,
    can_priemka: permissions.can_priemka === true,
  };
};

export function normalizeEmployees(data: unknown): Employee[] {
  return arr(data).map((x) => {
    const r = obj(x);
    const b = obj(r.base);
    const o = obj(r.override);
    return {
      refKey: String(r.ref_key ?? ''),
      code: String(r.code ?? ''),
      name: String(r.name ?? ''),
      phone: String(r.phone ?? ''),
      jobTitle: String(r.job_title ?? ''),
      department: String(r.department ?? ''),
      hiredAt: r.hired_at == null ? null : String(r.hired_at),
      balance: Number(r.balance ?? 0),
      totalReceived: Number(r.total_received ?? 0),
      totalCredited: Number(r.total_credited ?? 0),
      isActive: Boolean(r.is_active),
      isHidden: Boolean(r.is_hidden),
      hasAccess: Boolean(r.has_access),
      permissions: normalizePermissions(r.permissions),
      dayRate: numOrNull(r.day_rate),
      shiftStart: strOrNull(r.shift_start),
      shiftEnd: strOrNull(r.shift_end),
      workDaysPerMonth: numOrNull(r.work_days_per_month),
      monthlySalary: numOrNull(r.monthly_salary),
      base: {
        name: String(b.name ?? ''),
        phone: String(b.phone ?? ''),
        dayRate: numOrNull(b.day_rate),
        shiftStart: strOrNull(b.shift_start),
        shiftEnd: strOrNull(b.shift_end),
        salary: numOrNull(b.salary),
      },
      override: {
        firstName: strOrNull(o.first_name),
        lastName: strOrNull(o.last_name),
        middleName: strOrNull(o.middle_name),
        phone: strOrNull(o.phone),
        shiftStart: strOrNull(o.shift_start),
        shiftEnd: strOrNull(o.shift_end),
        workDaysPerMonth: numOrNull(o.work_days_per_month),
        dayRate: numOrNull(o.day_rate),
        monthlySalary: numOrNull(o.monthly_salary),
      },
    };
  });
}

export function normalizeEmployeeForEdit(data: unknown): EmployeeForEdit {
  const r = obj(data);
  const b = obj(r.base);
  return {
    refKey: String(r.ref_key ?? ''),
    lastName: strOrNull(r.last_name),
    firstName: strOrNull(r.first_name),
    middleName: strOrNull(r.middle_name),
    phone: strOrNull(r.phone),
    shiftStart: strOrNull(r.shift_start),
    shiftEnd: strOrNull(r.shift_end),
    workDaysPerMonth: numOrNull(r.work_days_per_month),
    dayRate: numOrNull(r.day_rate),
    monthlySalary: numOrNull(r.monthly_salary),
    isHidden: Boolean(r.is_hidden),
    login: strOrNull(r.login),
    passwordPlain: null,
    permissions: normalizePermissions(r.permissions),
    base: {
      name: String(b.name ?? ''),
      lastName: strOrNull(b.last_name),
      firstName: strOrNull(b.first_name),
      middleName: strOrNull(b.middle_name),
      phone: strOrNull(b.phone),
      shiftStart: strOrNull(b.shift_start),
      shiftEnd: strOrNull(b.shift_end),
      dayRate: numOrNull(b.day_rate),
      salary: numOrNull(b.salary),
    },
  };
}

/** breaks из RPC (jsonb-массив) → типизированный список отлучек. */
export function normalizeBreaks(data: unknown): AttendanceBreak[] {
  return arr(data).map((x) => {
    const b = obj(x);
    return {
      from: String(b.from ?? ''),
      to: String(b.to ?? ''),
      minutes: Number(b.minutes ?? 0),
      text: String(b.text ?? ''),
    };
  });
}

export function normalizeAttendance(data: unknown): AttendancePage {
  const o = obj(data);
  return {
    totalCount: Number(o.total_count ?? 0),
    rows: arr(o.rows).map((x, i) => {
      const r = obj(x);
      return {
        id: i,
        date: String(r.date ?? ''),
        employeeRef: String(r.employee_ref ?? ''),
        employeeName: String(r.employee_name ?? ''),
        cameAt: r.came_at == null ? null : String(r.came_at),
        leftAt: r.left_at == null ? null : String(r.left_at),
        onSite: Boolean(r.on_site),
        wasLate: Boolean(r.was_late),
        lateHours: Number(r.late_hours ?? 0),
        lateText: String(r.late_text ?? ''),
        breaks: normalizeBreaks(r.breaks),
        breaksCount: Number(r.breaks_count ?? 0),
        breakMinutes: Number(r.break_minutes ?? 0),
        breakText: String(r.break_text ?? ''),
        rate: Number(r.rate ?? 0),
        lateDeduction: Number(r.late_deduction ?? 0),
        breakDeduction: Number(r.break_deduction ?? 0),
        earned: Number(r.earned ?? 0),
        fine: Number(r.fine ?? 0),
      };
    }),
  };
}

export function normalizeAttendanceSummary(data: unknown): AttendanceSummaryRow[] {
  return arr(data).map((x) => {
    const r = obj(x);
    return {
      employeeRef: String(r.employee_ref ?? ''),
      employeeName: String(r.employee_name ?? ''),
      days: Number(r.days ?? 0),
      lates: Number(r.lates ?? 0),
      fines: Number(r.fines ?? 0),
      breaksTotalMinutes: Number(r.breaks_total_minutes ?? 0),
      deductionsTotal: Number(r.deductions_total ?? 0),
    };
  });
}

export function normalizeAttendanceDay(data: unknown): AttendanceDayRow[] {
  return arr(data).map((x) => {
    const r = obj(x);
    return {
      employeeRef: String(r.employee_ref ?? ''),
      employeeName: String(r.employee_name ?? ''),
      cameAt: r.came_at == null ? null : String(r.came_at),
      leftAt: r.left_at == null ? null : String(r.left_at),
      wasLate: Boolean(r.was_late),
      lateHours: Number(r.late_hours ?? 0),
      lateText: String(r.late_text ?? ''),
      breaks: normalizeBreaks(r.breaks),
      breaksCount: Number(r.breaks_count ?? 0),
      breakMinutes: Number(r.break_minutes ?? 0),
      breakText: String(r.break_text ?? ''),
      fine: Number(r.fine ?? 0),
      status: String(r.status ?? 'absent') as AttendanceDayStatus,
    };
  });
}

export function normalizeAttendanceDaySummary(data: unknown): AttendanceDaySummary {
  // RETURNS TABLE с одной строкой → PostgREST отдаёт массив из одного объекта.
  const r = obj(arr(data)[0]);
  return {
    cameCount: Number(r.came_count ?? 0),
    lateCount: Number(r.late_count ?? 0),
    finesTotal: Number(r.fines_total ?? 0),
  };
}

export function normalizeStaffPurchases(data: unknown): StaffPurchasesPage {
  const o = obj(data);
  return {
    totalCount: Number(o.total_count ?? 0),
    totalAmount: Number(o.total_amount ?? 0),
    byEmployee: arr(o.by_employee).map((x) => {
      const r = obj(x);
      return {
        employeeRef: String(r.employee_ref ?? ''),
        employeeName: String(r.employee_name ?? ''),
        amount: Number(r.amount ?? 0),
        count: Number(r.count ?? 0),
      };
    }),
    rows: arr(o.rows).map((x, i) => {
      const r = obj(x);
      return {
        id: i,
        date: String(r.date ?? ''),
        employeeName: String(r.employee_name ?? ''),
        productName: String(r.product_name ?? ''),
        qty: Number(r.qty ?? 0),
        amount: Number(r.amount ?? 0),
      };
    }),
  };
}
