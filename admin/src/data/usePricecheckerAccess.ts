import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import {
  normalizePricecheckerAccess,
  type PricecheckerAccessRow,
  type PricecheckerPermissions,
} from '../lib/pricecheckerAccess';

/** Обновить всё, на что влияет правка доступа: и эта страница, и список сотрудников. */
function invalidateAccess(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['pricechecker-access'] });
  void qc.invalidateQueries({ queryKey: ['employees'] });
  void qc.invalidateQueries({ queryKey: ['employee-for-edit'] });
}

export function usePricecheckerAccess(search: string, activeOnly: boolean) {
  return useQuery<PricecheckerAccessRow[]>({
    queryKey: ['pricechecker-access', search, activeOnly],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pricechecker_access', {
        p_search: search || null,
        p_active_only: activeOnly,
      });
      if (error) throw new Error(error.message);
      return normalizePricecheckerAccess(data);
    },
    placeholderData: (prev) => prev,
  });
}

/** Галочки прав. can_admin не передаём вовсе — на этой странице его не выдают. */
export function useSetAccessPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      refKey,
      permissions,
    }: {
      refKey: string;
      permissions: PricecheckerPermissions;
    }) => {
      const { error } = await supabase.rpc('set_employee_permissions', {
        p_ref: refKey,
        p_can_price_check: permissions.can_price_check,
        p_can_print_labels: permissions.can_print_labels,
        p_can_cabinet: permissions.can_cabinet,
        p_can_admin: false,
        p_can_stock: permissions.can_stock,
        p_can_priemka: permissions.can_priemka,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateAccess(qc),
  });
}

/** Выдать логин. Пароль возвращается один раз — показать и забыть. */
export function useGrantLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      refKey,
      login,
      password,
    }: {
      refKey: string;
      login: string;
      password: string | null;
    }): Promise<{ login: string; password: string }> => {
      const { data, error } = await supabase.rpc('admin_grant_pricechecker_login', {
        p_ref: refKey,
        p_login: login,
        p_password: password,
      });
      if (error) throw new Error(error.message);
      const row = (data ?? {}) as Record<string, unknown>;
      return { login: String(row.login ?? login), password: String(row.password ?? '') };
    },
    onSuccess: () => invalidateAccess(qc),
  });
}

/** Сброс пароля: сервер возвращает новый пароль ровно один раз. */
export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      refKey,
      password,
    }: {
      refKey: string;
      password: string | null;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('admin_reset_employee_password', {
        p_ref: refKey,
        p_password: password,
      });
      if (error) throw new Error(error.message);
      return String(data ?? '');
    },
    onSuccess: () => invalidateAccess(qc),
  });
}

export function useDisableAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (refKey: string) => {
      const { error } = await supabase.rpc('admin_disable_pricechecker_access', { p_ref: refKey });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateAccess(qc),
  });
}

export function useUnbindDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (refKey: string) => {
      const { error } = await supabase.rpc('admin_unbind_employee_device', { p_ref: refKey });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateAccess(qc),
  });
}
