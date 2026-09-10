import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Utils/sos-state.js', import.meta.url), 'utf8');
const { resolveSosUpdate } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('an existing SOS restores after the screen loses local state', () => {
  const alert = { id: 'resident-sos', status: 'active' };
  assert.deepEqual(resolveSosUpdate([alert], null), { kind: 'active', alert });
});

test('missing data, unrelated stops and intermediate states never dismiss the current SOS', () => {
  for (const rows of [[], [{ id: 'other-sos', status: 'completed' }], [{ id: 'resident-sos', status: 'acknowledged' }]]) {
    assert.deepEqual(resolveSosUpdate(rows, 'resident-sos'), { kind: 'unchanged' });
  }
});

test('a confirmed resident or CPF stop dismisses the matching SOS', () => {
  for (const status of ['cancelled', 'completed', 'resolved']) {
    assert.deepEqual(resolveSosUpdate([{ id: 'resident-sos', status }], 'resident-sos'), { kind: 'stopped' });
  }
});
