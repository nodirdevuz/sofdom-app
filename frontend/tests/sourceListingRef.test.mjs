import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSourceListingReference } from '../src/lib/sourceListingRef.ts';

test('keeps the source listing ID for migrated database records', () => {
  assert.equal(
    resolveSourceListingReference({
      id: 'SD-1001',
      external_ref: 'bezposr_175402',
    }),
    'bezposr_175402',
  );
});

test('uses the source-prefixed ID when no external reference exists', () => {
  assert.equal(
    resolveSourceListingReference({
      id: 'cian_3001',
      external_ref: null,
    }),
    'cian_3001',
  );
});
