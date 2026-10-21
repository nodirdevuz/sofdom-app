import { describe, expect, it } from 'vitest';
import { normalizePricecheckerAccess, suggestLoginFor } from './pricecheckerAccess';

describe('normalizePricecheckerAccess', () => {
  it('разбирает строку сотрудника с телефоном и правами', () => {
    const rows = normalizePricecheckerAccess([
      {
        ref_key: 'ref-1',
        name: 'Matkarimova Muslima',
        is_active: true,
        login: 'muslima',
        permissions: { can_price_check: true, can_print_labels: false, can_cabinet: true, can_stock: true },
        device: {
          name: 'samsung SM-G965F',
          bound_at: '2026-09-01T10:00:00+00:00',
          last_login_at: '2026-09-01T12:00:00+00:00',
        },
        last_seen_at: '2026-09-01T12:00:00+00:00',
        last_device_name: 'samsung SM-G965F',
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      refKey: 'ref-1',
      name: 'Matkarimova Muslima',
      login: 'muslima',
      isActive: true,
      permissions: {
        can_price_check: true,
        can_print_labels: false,
        can_cabinet: true,
        can_stock: true,
      },
      deviceName: 'samsung SM-G965F',
      lastSeenAt: '2026-09-01T12:00:00+00:00',
    });
  });

  it('сотрудник без логина и телефона читается без падения', () => {
    const [row] = normalizePricecheckerAccess([{ ref_key: 'ref-2', name: 'Без доступа', is_active: false }]);
    expect(row.login).toBeNull();
    expect(row.deviceName).toBeNull();
    expect(row.lastSeenAt).toBeNull();
    expect(row.permissions).toEqual({
      can_price_check: false,
      can_print_labels: false,
      can_cabinet: false,
      can_stock: false,
      can_priemka: false,
    });
  });

  it('мусор вместо ответа даёт пустой список, а не исключение', () => {
    expect(normalizePricecheckerAccess(null)).toEqual([]);
    expect(normalizePricecheckerAccess('не список')).toEqual([]);
  });

  it('права читаются строго по true: строка «true» правом не является', () => {
    const [row] = normalizePricecheckerAccess([
      {
        ref_key: 'r',
        name: 'N',
        permissions: { can_price_check: 'true', can_print_labels: 1, can_stock: 'true' },
      },
    ]);
    expect(row.permissions.can_price_check).toBe(false);
    expect(row.permissions.can_print_labels).toBe(false);
    // Остаток — самое опасное право: кривой ответ сервера не должен его открывать
    expect(row.permissions.can_stock).toBe(false);
  });

  it('старый ответ сервера без can_stock читается как «права нет»', () => {
    const [row] = normalizePricecheckerAccess([
      {
        ref_key: 'r',
        name: 'N',
        permissions: { can_price_check: true, can_print_labels: true, can_cabinet: true },
      },
    ]);
    expect(row.permissions.can_stock).toBe(false);
  });
});

describe('suggestLoginFor', () => {
  it('переводит имя в латиницу и нижний регистр', () => {
    expect(suggestLoginFor('Маткаримова Муслима')).toBe('matkarimova');
    expect(suggestLoginFor('Muslima')).toBe('muslima');
  });

  it('пустое имя не даёт мусорного логина', () => {
    expect(suggestLoginFor('')).toBe('');
    expect(suggestLoginFor('   ')).toBe('');
  });
});

describe('право на приёмку в списке доступа', () => {
  it('старый ответ сервера без can_priemka читается как «права нет»', () => {
    const [row] = normalizePricecheckerAccess([
      { ref_key: 'r1', name: 'X', is_active: true, permissions: { can_price_check: true } },
    ]);

    expect(row.permissions.can_priemka).toBe(false);
  });

  it('приёмка и остаток не путаются местами', () => {
    const [row] = normalizePricecheckerAccess([
      { ref_key: 'r1', name: 'X', is_active: true, permissions: { can_priemka: true, can_stock: false } },
    ]);

    expect(row.permissions.can_priemka).toBe(true);
    expect(row.permissions.can_stock).toBe(false);
  });
});
