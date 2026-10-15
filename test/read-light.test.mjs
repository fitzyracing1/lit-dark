import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (env) => spawnSync(process.execPath, ['--import', './test/mock-fetch.mjs', 'read-light.mjs', 'o/r'], {
  cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_TOKEN: '', ...env },
});
const run = (conclusion) => JSON.stringify([{ status: 'completed', conclusion, name: 'light', html_url: 'u', updated_at: 't' }]);

test('success is lit, bit 0', () => {
  const r = read({ MOCK_RUNS: run('success') });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /● lit {2}bit=0 {2}o\/r/);
});

test('cancelled is dark, bit 1', () => {
  const r = read({ MOCK_RUNS: run('cancelled') });
  assert.match(r.stdout, /○ dark {2}bit=1/);
});

test('no completed push run is an error, not dark', () => {
  const r = read({ MOCK_RUNS: '[]' });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /no completed push runs/);
});

test('HTTP failure is an error', () => {
  const r = read({ MOCK_STATUS: '404' });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
});
