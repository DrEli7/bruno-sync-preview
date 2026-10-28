import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { previewSync, toMarkdown } from '../src/index.mjs';
import converters from '@usebruno/converters';
const item = (name, overrides = {}) => ({ name, type: 'http-request', request: { url: '{{baseUrl}}/items?token=super-secret', method: 'GET', ...overrides } });
const collection = (...items) => ({ version: '1', name: 'API', items });
test('detects lost scripts, tests, variables and endpoint changes without exposing values', () => {
  const a = collection(item('List', { script: { req: 'SECRET_BODY' }, tests: 'SECRET_TEST', vars: { req: [{ name: 'key', value: 'SECRET_VALUE' }], res: [] } }));
  const b = collection(item('List', { url: '/v2/items', method: 'POST' }));
  const result = previewSync(a, b);
  assert.deepEqual(new Set(result.changes.map(c => c.field)), new Set(['url', 'method', 'script', 'tests', 'vars']));
  assert.equal(result.summary.risks, 5);
  assert.doesNotMatch(JSON.stringify(result), /SECRET|super-secret|baseUrl|v2/);
});
test('top-level item UIDs, sequence and JSON key order do not cause differences', () => {
  const a = collection({ ...item('List', { headers: [{ uid: 'x', name: 'Accept', value: 'json' }] }), uid: 'first', seq: 1 });
  const b = collection({ ...item('List', { headers: [{ value: 'json', name: 'Accept', uid: 'x' }] }), uid: 'second', seq: 2 });
  assert.equal(previewSync(a, b).summary.changes, 0);
});
test('nested payload fields named uid and filename remain meaningful changes', () => {
  const a = collection(item('Upload', { vars: { req: [{ name: 'payload', value: { uid: 'first', filename: 'before.png' } }] } }));
  const b = collection(item('Upload', { vars: { req: [{ name: 'payload', value: { uid: 'second', filename: 'after.png' } }] } }));
  assert.equal(previewSync(a, b).changes[0].field, 'vars');
  assert.equal(previewSync(a, b).summary.risks, 1);
});
test('exact path segments avoid slash collisions and detect rename as removal plus addition', () => {
  const a = collection(item('A/B'), { type: 'folder', name: 'A', items: [item('B')] });
  const b = collection(item('Renamed'), { type: 'folder', name: 'A', items: [item('B')] });
  const changes = previewSync(a, b).changes;
  assert.equal(changes.length, 2);
  assert.deepEqual(changes[0].path, ['A/B']);
});
test('ambiguous identities and unsupported inputs fail loudly', () => {
  assert.throws(() => previewSync(collection(item('x'), item('x')), collection()), /duplicate/);
  assert.throws(() => previewSync({}, collection()), /items array/);
  assert.throws(() => previewSync(collection({ name: 'socket', type: 'ws-request' }), collection()), /unsupported/);
});
test('inherited folder and collection customization losses are visible', () => {
  const a = collection({ name: 'folder', type: 'folder', items: [], root: { request: { tests: 'SENTINEL_SECRET' } } });
  a.root = { request: { script: { req: 'SENTINEL_SECRET' } } };
  a.environments = [{ name: 'SENTINEL_SECRET', variables: [{ name: 'TOKEN', value: 'SENTINEL_SECRET' }] }];
  const result = previewSync(a, collection({ name: 'folder', type: 'folder', items: [] }));
  assert.equal(result.summary.risks, 3);
  assert.doesNotMatch(toMarkdown(result), /SENTINEL_SECRET|TOKEN/);
});
test('accepts the actual official OpenAPI converter result', () => {
  const generated = converters.openApiToBruno({ openapi: '3.0.3', info: { title: 'Synthetic test', version: '1' }, servers: [{ url: 'https://example.invalid' }], paths: { '/pets': { get: { summary: 'List pets', responses: { 200: { description: 'OK' } } } } } });
  assert.ok(generated.items.length > 0);
  assert.equal(previewSync(generated, structuredClone(generated)).summary.changes, 0);
});
test('Markdown names cannot inject HTML or table columns', () => {
  const md = toMarkdown(previewSync(collection(item('<script>|\n`x`')), collection()));
  assert.doesNotMatch(md, /<script>/);
  assert.match(md, /&#60;script&#62;&#124;/);
});
test('CLI provides JSON, risk gate and strict usage errors without changing inputs', () => {
  const cwd = new URL('..', import.meta.url);
  const args = ['src/cli.mjs', 'examples/current.json', 'examples/candidate.json', '--format', 'json', '--fail-on-risk'];
  const before = readFileSync(new URL('../examples/current.json', import.meta.url), 'utf8');
  const run = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  assert.equal(run.status, 1, run.stderr);
  assert.ok(JSON.parse(run.stdout).summary.risks > 0);
  assert.equal(readFileSync(new URL('../examples/current.json', import.meta.url), 'utf8'), before);
  assert.equal(spawnSync(process.execPath, ['src/cli.mjs', '--unknown'], { cwd }).status, 2);
  assert.equal(spawnSync(process.execPath, ['src/cli.mjs', '--help'], { cwd }).status, 0);
});
