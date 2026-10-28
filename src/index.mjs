import { isDeepStrictEqual } from 'node:util';

const requestFields = ['script', 'tests', 'vars', 'assertions', 'auth', 'headers', 'params', 'body', 'docs'];
function populated(value) {
  if (value == null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.values(value).some(populated);
  return true;
}
// Payload keys such as uid/filename may be meaningful; compare them strictly.
// Item identity metadata is ignored only by not selecting it in previewSync.
const same = (a, b) => isDeepStrictEqual(a, b);
function index(collection, label) {
  if (!collection || typeof collection !== 'object' || !Array.isArray(collection.items)) throw new Error(`${label}: expected Bruno collection JSON with items array`);
  if (collection.version !== undefined && !['1', 1].includes(collection.version)) throw new Error(`${label}: unsupported collection version`);
  const entries = new Map();
  const walk = (items, parent = [], depth = 0) => {
    if (depth > 50) throw new Error(`${label}: collection nesting exceeds 50`);
    for (const item of items) {
      if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name.trim()) throw new Error(`${label}: every item needs a nonempty name`);
      const path = [...parent, item.name];
      const key = JSON.stringify(path);
      if (entries.has(key)) throw new Error(`${label}: duplicate folder/name identity; rename ambiguous items first`);
      if (!['folder', 'http-request', 'graphql-request'].includes(item.type)) throw new Error(`${label}: unsupported item type; only folders, HTTP and GraphQL are supported`);
      if (item.type === 'folder' && !Array.isArray(item.items)) throw new Error(`${label}: folder items must be an array`);
      if (item.type !== 'folder' && (!item.request || typeof item.request.url !== 'string' || typeof item.request.method !== 'string')) throw new Error(`${label}: request requires string url and method`);
      entries.set(key, { path, item });
      if (item.type === 'folder') walk(item.items, path, depth + 1);
    }
  };
  walk(collection.items);
  return entries;
}

/** Compare replacing current with candidate. No requests, files, or scripts are executed. */
export function previewSync(current, candidate) {
  const before = index(current, 'current');
  const after = index(candidate, 'candidate');
  const changes = [];
  const add = (path, field, operation, risk) => changes.push({ path, field, operation, risk });
  for (const [key, { path, item: a }] of before) {
    const b = after.get(key)?.item;
    if (!b) { add(path, 'item', 'removed', true); continue; }
    if (a.type !== b.type) add(path, 'type', 'changed', true);
    const ar = a.type === 'folder' ? a.root?.request : a.request;
    const br = b.type === 'folder' ? b.root?.request : b.request;
    for (const field of ['method', 'url', ...requestFields]) {
      if (!same(ar?.[field], br?.[field])) add(path, field, populated(br?.[field]) ? (populated(ar?.[field]) ? 'changed' : 'added') : 'removed', populated(ar?.[field]));
    }
    for (const field of ['settings', 'examples', 'app', 'description', 'tags']) {
      if (!same(a[field], b[field])) add(path, field, populated(b[field]) ? 'changed' : 'removed', populated(a[field]));
    }
    if (!same(a.root?.docs, b.root?.docs)) add(path, 'folder.docs', populated(b.root?.docs) ? 'changed' : 'removed', populated(a.root?.docs));
  }
  for (const [key, { path }] of after) if (!before.has(key)) add(path, 'item', 'added', false);
  for (const field of ['environments', 'root', 'brunoConfig']) {
    if (!same(current[field], candidate[field])) add([], field, populated(candidate[field]) ? (populated(current[field]) ? 'changed' : 'added') : 'removed', populated(current[field]));
  }
  return {
    schemaVersion: 1,
    model: 'whole-collection-replacement',
    summary: { currentItems: before.size, candidateItems: after.size, changes: changes.length, risks: changes.filter(c => c.risk).length },
    changes,
    limitations: ['Matching uses exact folder/name paths, not generated UIDs. Moves and renames appear as removal plus addition.', 'This is a replacement-risk checklist, not a simulation of the Bruno Sync merge algorithm.', 'Values, URLs, scripts and request bodies are omitted; item names remain visible.']
  };
}
function cell(value) { return String(value).replace(/[\r\n]/g, ' ').replace(/[&<>|`\\\[\]()!]/g, c => `&#${c.codePointAt(0)};`); }
export function toMarkdown(report) {
  return ['# Bruno sync replacement preview', '', `${report.summary.changes} changes; ${report.summary.risks} items/fields need review.`, '', '| Location | Field | Change | Review |', '| --- | --- | --- | --- |', ...report.changes.map(c => `| ${cell(c.path.length ? JSON.stringify(c.path) : '(collection)')} | ${c.field} | ${c.operation} | ${c.risk ? 'yes' : 'no'} |`), '', 'No field values or request URLs are included. Names may still be private.', '', ...report.limitations.map(l => `- ${l}`), ''].join('\n');
}
