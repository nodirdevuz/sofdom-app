import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import {
  normalizeMyAttendance,
  normalizeMyProfile,
  normalizeMyPurchases,
  normalizeMySalary,
  type MyAttendanceDay,
  type MyProfile,
  type MyPurchases,
  type MySalary,
} from '../lib/cabinet';

async function rpc<T>(fn: string, params: Record<string, unknown>, map: (d: unknown) => T): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message);
  return map(data);
}

/** Профиль вошедшего сотрудника. data === null → сессия умерла (кабинет разлогинит). */
export function useMyProfile(token: string) {
  return useQuery<MyProfile | null>({
    queryKey: ['my-profile', token],
    queryFn: () => rpc('get_my_profile', { p_token: token }, normalizeMyProfile),
  });
}

/** Мой табель за месяц (p_month — первое число месяца, YYYY-MM-01). */
export function useMyAttendance(token: string, month: string) {
  return useQuery<MyAttendanceDay[]>({
    queryKey: ['my-attendance', token, month],
    queryFn: () => rpc('get_my_attendance', { p_token: token, p_month: month }, normalizeMyAttendance),
  });
}

/** Моя зарплата за месяц: по дням + итог (покупки в счёт зарплаты вычитаются). */
export function useMySalary(token: string, month: string) {
  return useQuery<MySalary | null>({
    queryKey: ['my-salary', token, month],
    queryFn: () => rpc('get_my_salary', { p_token: token, p_month: month }, normalizeMySalary),
  });
}

/** Мои покупки в счёт зарплаты за месяц. */
export function useMyPurchases(token: string, month: string) {
  return useQuery<MyPurchases>({
    queryKey: ['my-purchases', token, month],
    queryFn: () => rpc('get_my_purchases', { p_token: token, p_month: month }, normalizeMyPurchases),
  });
}
