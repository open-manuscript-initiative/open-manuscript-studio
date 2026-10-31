import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// UI ownership regression: keep actual storage operations centralized rather
// than duplicating the same cloud-upload action in Integration and Document UI.
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const menu = read('src/components/StudioMenu.tsx');
const clouds = read('src/components/CloudStorageSettings.tsx');
const integrations = read('src/components/IntegrationsPanel.tsx');
const between = (source, start, end) => source.split(start)[1]?.split(end)[0] ?? '';

test('Document menu owns Save, Save As and existing portable backup action', () => {
  const document = between(menu, 'function DocumentMenuView(', 'function ManuscriptDataView(');
  const tools = between(menu, 'function ToolsView()', 'function SettingsView()');
  assert.match(document, /saveLocalManuscriptAs\(current\)/);
  assert.match(document, /saveLocalManuscript\(current\)/);
  assert.match(document, /savePortableManuscriptCopy\(current\)/);
  assert.match(document, /savePortableBackup\(\)/);
  assert.match(document, /<CloudStorageSettings view="documents" \/>/);
  assert.match(document, /cloudBackupsExpanded \? <CloudStorageSettings view="documents" \/> : null/);
  assert.match(document, /aria-expanded=\{cloudBackupsExpanded\}/);
  assert.match(document, /onClick=\{\(\) => setCloudBackupsExpanded/);
  assert.match(menu, /useState\(false\)/);

  assert.doesNotMatch(tools, /saveLocalManuscript|savePortableManuscriptCopy|savePortableBackup|nativeSaveCard/);
});

test('Integrations shows only account setup and Document shows only cloud backup/restore', () => {
  assert.match(integrations, /<CloudStorageSettings \/>/);
  assert.match(clouds, /view = 'connections'/);
  assert.match(clouds, /view === 'connections' \? <>/);
  assert.match(clouds, /view === 'documents' \? <>/);
  const connectionUi = between(clouds, "{view === 'connections' ? <>", '</> : null}');
  const documentUi = between(clouds, "{view === 'documents' ? <>", '</> : null}');
  assert.match(connectionUi, /copy\.providerSetup/);
  assert.match(connectionUi, /copy\.connectionTitle/);
  assert.doesNotMatch(connectionUi, /copy\.saveBackup|copy\.backups/);
  assert.match(documentUi, /copy\.saveBackup/);
  assert.match(documentUi, /copy\.backups/);
  assert.doesNotMatch(documentUi, /copy\.password|connectWebDav\(\)/);
  assert.match(clouds, /await uploadCloudBackup\(/);
  assert.match(clouds, /await downloadCloudBackup\(/);
});
