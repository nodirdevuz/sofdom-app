import { describe, expect, it } from 'vitest';
import { normalizeEmployeeForEdit, normalizeEmployees } from './staff';

const permissions = {
  can_price_check: true,
  can_print_labels: false,
  can_cabinet: true,
  can_admin: false,
  can_stock: true,
  can_priemka: true,
};

describe('permissions сотрудника', () => {
  it('normalizeEmployees читает шесть булевых флагов из вложенного permissions', () => {
    const [employee] = normalizeEmployees([{ ref_key: 'employee-1', permissions }]);

    expect(employee.permissions).toEqual(permissions);
  });

  it('normalizeEmployees превращает отсутствующие и неверные permissions в false', () => {
    const [employee] = normalizeEmployees([
      {
        ref_key: 'employee-1',
        permissions: { can_price_check: 'true', can_print_labels: 1, can_cabinet: null },
      },
    ]);

    expect(employee.permissions).toEqual({
      can_price_check: false,
      can_print_labels: false,
      can_cabinet: false,
      can_admin: false,
      can_stock: false,
      can_priemka: false,
    });
  });

  it('normalizeEmployeeForEdit читает шесть булевых флагов из вложенного permissions', () => {
    const employee = normalizeEmployeeForEdit({ ref_key: 'employee-1', permissions });

    expect(employee.permissions).toEqual(permissions);
  });

  it('normalizeEmployeeForEdit превращает отсутствующие и неверные permissions в false', () => {
    const employee = normalizeEmployeeForEdit({
      ref_key: 'employee-1',
      permissions: { can_price_check: true, can_print_labels: 'false', can_cabinet: 0, can_admin: undefined },
    });

    expect(employee.permissions).toEqual({
      can_price_check: true,
      can_print_labels: false,
      can_cabinet: false,
      can_admin: false,
      can_stock: false,
      can_priemka: false,
    });
  });
});

describe('право на приёмку', () => {
  it('старый ответ сервера без can_priemka читается как «права нет»', () => {
    // Пока не выкачена миграция, ручки отдают четыре флага. Отсутствие поля
    // обязано означать «нельзя»: иначе экран нарисует галочку, а сервер откажет.
    const [employee] = normalizeEmployees([
      { ref_key: 'employee-1', permissions: { can_price_check: true } },
    ]);

    expect(employee.permissions.can_priemka).toBe(false);
  });

  it('строка «true» правом на приёмку не является', () => {
    const employee = normalizeEmployeeForEdit({
      ref_key: 'employee-1',
      permissions: { can_priemka: 'true' },
    });

    expect(employee.permissions.can_priemka).toBe(false);
  });

  it('приёмка и остаток — разные права, одно не включает другое', () => {
    const employee = normalizeEmployeeForEdit({
      ref_key: 'employee-1',
      permissions: { can_priemka: true, can_stock: false },
    });

    expect(employee.permissions.can_priemka).toBe(true);
    expect(employee.permissions.can_stock).toBe(false);
  });
});
