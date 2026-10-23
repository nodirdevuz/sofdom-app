export function resolveSourceListingReference(record: {
  id: string;
  external_ref?: string | null;
}): string {
  return record.external_ref || record.id;
}
