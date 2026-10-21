import { describe, expect, it } from 'vitest';
import { hasCabinetPermission } from './employeeAccess';

describe('hasCabinetPermission', () => {
  it('разрешает кабинет только при can_cabinet === true', () => {
    expect(hasCabinetPermission({ can_cabinet: true })).toBe(true);
  });

  it.each([
    undefined,
    null,
    {},
    { can_cabinet: false },
    { can_cabinet: 'true' },
    { can_cabinet: 1 },
  ])('отказывает для неверного ответа: %o', (permissions) => {
    expect(hasCabinetPermission(permissions)).toBe(false);
  });
});
