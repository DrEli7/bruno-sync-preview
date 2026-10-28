#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { previewSync, toMarkdown } from './index.mjs';
const help = 'Usage: bruno-sync-preview CURRENT.json CANDIDATE.json [--format markdown|json] [--fail-on-risk]\nOffline; stdout only. Exit 0: report, 1: risk gate, 2: invalid input.\n';
try {
  const { values, positionals } = parseArgs({ options: { help: { type: 'boolean', short: 'h' }, format: { type: 'string', default: 'markdown' }, 'fail-on-risk': { type: 'boolean' } }, allowPositionals: true, strict: true });
  if (values.help) process.stdout.write(help);
  else {
    if (positionals.length !== 2 || !['json', 'markdown'].includes(values.format)) throw new Error(help.trim());
    const read = file => { try { return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { throw new Error('Could not read/parse input JSON (details hidden to avoid leaking values).'); } };
    const report = previewSync(read(positionals[0]), read(positionals[1]));
    process.stdout.write(values.format === 'json' ? JSON.stringify(report, null, 2) + '\n' : toMarkdown(report));
    if (values['fail-on-risk'] && report.summary.risks) process.exitCode = 1;
  }
} catch (error) { process.stderr.write(`bruno-sync-preview: ${error.message}\n`); process.exitCode = 2; }
