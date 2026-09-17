import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../../../routes/+page.svelte', import.meta.url), 'utf8');
const board = readFileSync(new URL('../../Coworkers.svelte', import.meta.url), 'utf8');

test('3G task workspaces retain a usable narrow-layout path and reduced-motion override', () => {
  assert.match(page, /@media\(max-width:600px\).*\.drawer-layout,\.inbox-grid\{grid-template-columns:1fr\}/s);
  assert.match(page, /@media\(max-width:650px\)\{\.task-thread\{inset:8px;padding:14px\}/);
  assert.match(page, /\.reduce-motion :global\(\*\)\{animation:none!important;transition:none!important\}/);
  assert.match(board, /\.lanes\{display:grid;grid-template-columns:repeat\(4,minmax\(210px,1fr\)\);gap:12px;overflow:auto\}/);
});
