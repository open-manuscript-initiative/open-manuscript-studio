import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const densityCss = readFileSync(
  new URL('../src/styles/ui-density.css', import.meta.url),
  'utf8',
);
const main = readFileSync(
  new URL('../src/main.tsx', import.meta.url),
  'utf8',
);

test('Studio loads the shared density layer after feature styles', () => {
  const metadataImport = main.indexOf("import './styles/scholarly-metadata.css';");
  const densityImport = main.indexOf("import './styles/ui-density.css';");

  assert.ok(metadataImport >= 0);
  assert.ok(densityImport > metadataImport);
});

test('desktop density uses more of the viewport and reduces non-functional spacing', () => {
  assert.match(densityCss, /@media \(min-width: 761px\)/);
  assert.match(densityCss, /\.focus-editor \{[\s\S]*width: min\(100%, 88rem\)/);
  assert.match(densityCss, /\.studio-menu-view \{[\s\S]*width: min\(100%, 82rem\)/);
  assert.match(densityCss, /\.studio-menu-nav-button \{[\s\S]*min-height: 2\.1rem/);
  assert.match(densityCss, /\.omi-writing-pane \{[\s\S]*padding: \.9rem/);
  assert.match(densityCss, /\.omi-document-canvas \{[\s\S]*padding: \.65rem \.5rem 1\.5rem/);
  assert.match(densityCss, /\.omi-continuous-sections \{[\s\S]*gap: 1\.55rem/);
});

test('short desktop viewports receive an additional vertical compaction pass', () => {
  assert.match(
    densityCss,
    /@media \(min-width: 761px\) and \(max-height: 850px\)/,
  );
  assert.match(
    densityCss,
    /min-height: calc\(100vh - 5\.5rem\)/,
  );
});

test('mobile density preserves primary touch targets while removing surrounding whitespace', () => {
  assert.match(
    densityCss,
    /--omi-density-touch-target: 44px/,
  );
  assert.match(
    densityCss,
    /@media \(max-width: 760px\)[\s\S]*\.mobile-action-button \{[\s\S]*min-height: var\(--omi-density-touch-target\)/,
  );
  assert.match(
    densityCss,
    /\.studio-menu-primary-action,[\s\S]*\.studio-menu-secondary-action \{[\s\S]*min-height: var\(--omi-density-touch-target\)/,
  );
  assert.match(
    densityCss,
    /\.studio-menu-navigation \{[\s\S]*grid-auto-rows: minmax\(3\.25rem, auto\)/,
  );
  assert.match(
    densityCss,
    /\.mobile-document-view,[\s\S]*\.mobile-details-view \{[\s\S]*padding: 10px 10px 16px/,
  );
});
