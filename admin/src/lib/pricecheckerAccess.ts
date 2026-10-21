// Чистая логика страницы «Доступ к PriceChecker»: типы и разбор ответа RPC.
// Пароли здесь не появляются никогда — сервер отдаёт новый пароль ровно один раз
// в ответе на сброс, и он живёт только в состоянии открытого окна.

import { suggestLogin } from './staff';

/** Права, которыми управляет владелец на этой странице. can_admin сюда не входит. */
export interface PricecheckerPermissions {
  can_price_check: boolean;
  can_print_labels: boolean;
  can_cabinet: boolean;
  /**
   * Отправка фактического остатка. Право особое: по нему пушер заводит
   * документ списания или инвентаризации в БОЕВОЙ 1С, поэтому по умолчанию
   * выключено и на экране помечено как опасное.
   */
  can_stock: boolean;
  /**
   * Правка карточки товара в приёмке: категория, бренд, параметр. Безопасное —
   * остатки не двигает, поэтому его дают многим приёмщикам.
   */
  can_priemka: boolean;
}

export interface PricecheckerAccessRow {
  refKey: string;
  name: string;
  isActive: boolean;
  /** null — учётки нет, войти в приложение нечем. */
  login: string | null;
  permissions: PricecheckerPermissions;
  /** Телефон, закреплённый за аккаунтом. null — ещё не привязан. */
  deviceName: string | null;
  deviceBoundAt: string | null;
  /** Когда сотрудник последний раз входил. */
  lastSeenAt: string | null;
}

const obj = (x: unknown): Record<string, unknown> => (x ?? {}) as Record<string, unknown>;
const strOrNull = (x: unknown): string | null => {
  if (x == null) return null;
  const s = String(x);
  return s === '' ? null : s;
};

/**
 * Право есть только при строгом `true`. Строка «true» или единица правом не являются:
 * иначе кривой ответ сервера открыл бы доступ вместо того, чтобы закрыть.
 */
const normalizePermissions = (value: unknown): PricecheckerPermissions => {
  const p = obj(value);
  return {
    can_price_check: p.can_price_check === true,
    can_print_labels: p.can_print_labels === true,
    can_cabinet: p.can_cabinet === true,
    can_stock: p.can_stock === true,
    can_priemka: p.can_priemka === true,
  };
};

export function normalizePricecheckerAccess(data: unknown): PricecheckerAccessRow[] {
  if (!Array.isArray(data)) return [];
  return data.map((x) => {
    const r = obj(x);
    const device = obj(r.device);
    return {
      refKey: String(r.ref_key ?? ''),
      name: String(r.name ?? ''),
      isActive: r.is_active === true,
      login: strOrNull(r.login),
      permissions: normalizePermissions(r.permissions),
      deviceName: strOrNull(device.name) ?? strOrNull(r.last_device_name),
      deviceBoundAt: strOrNull(device.bound_at),
      lastSeenAt: strOrNull(r.last_seen_at),
    };
  });
}

/** Подсказка логина по фамилии: владелец не должен придумывать латиницу сам. */
export function suggestLoginFor(name: string): string {
  const firstWord = name.trim().split(/\s+/)[0] ?? '';
  return suggestLogin(firstWord);
}
