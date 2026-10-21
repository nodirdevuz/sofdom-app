import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import {
  normalizeAttendance,
  normalizeAttendanceDay,
  normalizeAttendanceDaySummary,
  normalizeAttendanceSummary,
  normalizeEmployeeForEdit,
  normalizeEmployees,
  normalizeStaffPurchases,
  type AttendanceDayRow,
  type AttendanceDaySummary,
  type AttendancePage,
  type AttendanceSummaryRow,
  type Employee,
  type EmployeeForEdit,
  type EmployeePermissions,
  type StaffPurchasesPage,
} from '../lib/staff';

async function rpc<T>(fn: string, params: Record<string, unknown>, map: (d: unknown) => T): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message);
  return map(data);
}

/** Сотрудники с балансами (активные сверху с сервера). Скрытые — только по showHidden. */
export function useEmployees(search: string, activeOnly: boolean, showHidden = false) {
  return useQuery<Employee[]>({
    queryKey: ['employees', search, activeOnly, showHidden],
    queryFn: () =>
      rpc(
        'get_employees',
        { p_search: search || null, p_active_only: activeOnly, p_show_hidden: showHidden },
        normalizeEmployees,
      ),
    placeholderData: (prev) => prev,
  });
}

/** Сотрудник для окна редактирования: merge-значения полей (override поверх 1С) + base.
 * gcTime 0 — каждое открытие окна тянет свежие данные (1С могла обновиться). */
export function useEmployeeForEdit(refKey: string) {
  return useQuery<EmployeeForEdit>({
    queryKey: ['employee-for-edit', refKey],
    queryFn: async () => {
      const e = await rpc('get_employee_for_edit', { p_ref: refKey }, normalizeEmployeeForEdit);
      if (!e.refKey) throw new Error(`employee not found: ${refKey}`);
      return e;
    },
    gcTime: 0,
  });
}

/** Ручные правки сотрудника (окно редактирования). null/пустое поле = «брать из 1С». */
export interface EmployeeOverrideInput {
  employeeRef: string;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  phone: string | null;
  shiftStart: string | null; // 'HH:MM'
  shiftEnd: string | null;
  workDaysPerMonth: number | null;
  dayRate: number | null;
  monthlySalary: number | null;
  isHidden: boolean;
}

/** Сохранить правки (полная замена override-строки) и обновить все списки сотрудников. */
export function useUpsertEmployeeOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (o: EmployeeOverrideInput) => {
      const { error } = await supabase.rpc('upsert_employee_override', {
        p_employee_ref: o.employeeRef,
        p_first_name: o.firstName,
        p_last_name: o.lastName,
        p_middle_name: o.middleName,
        p_phone: o.phone,
        p_shift_start: o.shiftStart,
        p_shift_end: o.shiftEnd,
        p_work_days_per_month: o.workDaysPerMonth,
        p_day_rate: o.dayRate,
        p_monthly_salary: o.monthlySalary,
        p_is_hidden: o.isHidden,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateStaffQueries(qc),
  });
}

/** Логин/пароль кабинета сотрудника. Пустой пароль = не менять хеш;
 * пустой логин = отозвать доступ. Хеширует сервер (set_employee_credentials). */
export function useSetEmployeeCredentials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { employeeRef: string; login: string; password: string }) => {
      const { error } = await supabase.rpc('set_employee_credentials', {
        p_ref: c.employeeRef,
        p_login: c.login,
        p_password: c.password || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateStaffQueries(qc),
  });
}

export function useSetEmployeePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeRef, permissions }: { employeeRef: string; permissions: EmployeePermissions }) => {
      const { error } = await supabase.rpc('set_employee_permissions', {
        p_ref: employeeRef,
        p_can_price_check: permissions.can_price_check,
        p_can_print_labels: permissions.can_print_labels,
        p_can_cabinet: permissions.can_cabinet,
        p_can_admin: permissions.can_admin,
        p_can_stock: permissions.can_stock,
        p_can_priemka: permissions.can_priemka,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['employees'] });
      void qc.invalidateQueries({ queryKey: ['employee-for-edit'] });
    },
  });
}

/** Массово скрыть/вернуть сотрудников (галочки в списке → одна кнопка). */
export function useSetEmployeesHidden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ refs, hidden }: { refs: string[]; hidden: boolean }) => {
      const { error } = await supabase.rpc('set_employees_hidden', {
        p_refs: refs,
        p_hidden: hidden,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateStaffQueries(qc),
  });
}

/** Правки/скрытие затрагивают все экраны раздела: список, Контроль, Табель, Покупки. */
function invalidateStaffQueries(qc: ReturnType<typeof useQueryClient>): void {
  for (const key of [
    'employees',
    'attendance-day',
    'attendance-day-summary',
    'attendance',
    'attendance-summary',
    'staff-purchases',
  ]) {
    void qc.invalidateQueries({ queryKey: [key] });
  }
}

export interface AttendanceParams {
  from?: string | null;
  to?: string | null;
  employeeRef?: string | null;
  limit?: number;
  offset?: number;
}

/** Строки табеля (серверная пагинация; null-границы = без ограничения). */
export function useAttendance(params: AttendanceParams) {
  const { from = null, to = null, employeeRef = null, limit = 50, offset = 0 } = params;
  return useQuery<AttendancePage>({
    queryKey: ['attendance', from, to, employeeRef, limit, offset],
    queryFn: () =>
      rpc(
        'get_attendance',
        { p_from: from, p_to: to, p_employee_ref: employeeRef, p_limit: limit, p_offset: offset },
        normalizeAttendance,
      ),
    placeholderData: (prev) => prev,
  });
}

/** Итоги табеля по сотрудникам за период. */
export function useAttendanceSummary(from: string, to: string) {
  return useQuery<AttendanceSummaryRow[]>({
    queryKey: ['attendance-summary', from, to],
    queryFn: () => rpc('get_attendance_summary', { p_from: from, p_to: to }, normalizeAttendanceSummary),
  });
}

/** Контроль явки: одна чистая строка на сотрудника за день (дубли убирает RPC). */
export function useAttendanceDay(date: string) {
  return useQuery<AttendanceDayRow[]>({
    queryKey: ['attendance-day', date],
    queryFn: () => rpc('get_attendance_day', { p_date: date }, normalizeAttendanceDay),
    placeholderData: (prev) => prev,
  });
}

/** KPI дня явки: пришло, опоздало, сумма штрафов. */
export function useAttendanceDaySummary(date: string) {
  return useQuery<AttendanceDaySummary>({
    queryKey: ['attendance-day-summary', date],
    queryFn: () => rpc('get_attendance_day_summary', { p_date: date }, normalizeAttendanceDaySummary),
    placeholderData: (prev) => prev,
  });
}

/** Покупки сотрудников: строки с пагинацией + итог по сотрудникам. */
export function useStaffPurchases(params: AttendanceParams) {
  const { from = null, to = null, employeeRef = null, limit = 50, offset = 0 } = params;
  return useQuery<StaffPurchasesPage>({
    queryKey: ['staff-purchases', from, to, employeeRef, limit, offset],
    queryFn: () =>
      rpc(
        'get_employee_purchases',
        { p_from: from, p_to: to, p_employee_ref: employeeRef, p_limit: limit, p_offset: offset },
        normalizeStaffPurchases,
      ),
    placeholderData: (prev) => prev,
  });
}
