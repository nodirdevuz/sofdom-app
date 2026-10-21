// Личный кабинет сотрудника (бот Komfort Team): типы + нормализация RPC-ответов.
// Только чтение; все запросы — по токену сессии (см. auth.tsx), ref клиенту не виден.

import { normalizeBreaks, type AttendanceBreak } from './staff';

export interface MyProfile {
  name: string;
  jobTitle: string;
  phone: string;
  isActive: boolean;
}

export interface MyAttendanceDay {
  date: string;
  cameAt: string | null;
  leftAt: string | null;
  /** Ещё на месте (уход не отмечен). */
  onSite: boolean;
  lateMinutes: number;
  /** Отлучки за день; text — готовая строка RPC («10:45–12:16, 1 соат 30 дақиқа»). */
  breaks: AttendanceBreak[];
  breakMinutes: number;
  fine: number;
}

export interface MySalaryDay {
  date: string;
  rate: number;
  lateMinutes: number;
  /** Вычет за опоздание (день = ставка − опоздание − отлучки − штраф). */
  lateDeduction: number;
  breaks: AttendanceBreak[];
  breakMinutes: number;
  breakText: string;
  breakDeduction: number;
  /** Суммарный вычет дня (опоздание + отлучки + штраф 1С). */
  deduction: number;
  earned: number;
}

export interface MySalary {
  days: MySalaryDay[];
  totalEarned: number;
  totalDeducted: number;
  purchasesTotal: number;
  payable: number;
}

export interface MyPurchases {
  totalAmount: number;
  rows: { date: string; productName: string; qty: number; amount: number }[];
}

const obj = (x: unknown): Record<string, unknown> => (x ?? {}) as Record<string, unknown>;
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

/** null из RPC = сессия недействительна (клиент разлогинивает). */
export function normalizeMyProfile(data: unknown): MyProfile | null {
  if (data == null) return null;
  const r = obj(data);
  return {
    name: String(r.name ?? ''),
    jobTitle: String(r.job_title ?? ''),
    phone: String(r.phone ?? ''),
    isActive: Boolean(r.is_active),
  };
}

export function normalizeMyAttendance(data: unknown): MyAttendanceDay[] {
  return arr(data).map((x) => {
    const r = obj(x);
    return {
      date: String(r.date ?? ''),
      cameAt: r.came_at == null ? null : String(r.came_at),
      leftAt: r.left_at == null ? null : String(r.left_at),
      onSite: Boolean(r.on_site),
      lateMinutes: Number(r.late_minutes ?? 0),
      breaks: normalizeBreaks(r.breaks),
      breakMinutes: Number(r.break_minutes ?? 0),
      fine: Number(r.fine ?? 0),
    };
  });
}

export function normalizeMySalary(data: unknown): MySalary | null {
  if (data == null) return null;
  const r = obj(data);
  return {
    days: arr(r.days).map((x) => {
      const d = obj(x);
      return {
        date: String(d.date ?? ''),
        rate: Number(d.rate ?? 0),
        lateMinutes: Number(d.late_minutes ?? 0),
        lateDeduction: Number(d.late_deduction ?? 0),
        breaks: normalizeBreaks(d.breaks),
        breakMinutes: Number(d.break_minutes ?? 0),
        breakText: String(d.break_text ?? ''),
        breakDeduction: Number(d.break_deduction ?? 0),
        deduction: Number(d.deduction ?? 0),
        earned: Number(d.earned ?? 0),
      };
    }),
    totalEarned: Number(r.total_earned ?? 0),
    totalDeducted: Number(r.total_deducted ?? 0),
    purchasesTotal: Number(r.purchases_total ?? 0),
    payable: Number(r.payable ?? 0),
  };
}

export function normalizeMyPurchases(data: unknown): MyPurchases {
  const r = obj(data);
  return {
    totalAmount: Number(r.total_amount ?? 0),
    rows: arr(r.rows).map((x) => {
      const p = obj(x);
      return {
        date: String(p.date ?? ''),
        productName: String(p.product_name ?? ''),
        qty: Number(p.qty ?? 0),
        amount: Number(p.amount ?? 0),
      };
    }),
  };
}
