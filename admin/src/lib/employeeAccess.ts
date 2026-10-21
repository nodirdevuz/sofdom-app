export function hasCabinetPermission(permissions: unknown): boolean {
  if (typeof permissions !== 'object' || permissions === null) return false;
  return (permissions as Record<string, unknown>).can_cabinet === true;
}
