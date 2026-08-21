import assert from 'node:assert/strict';
import test from 'node:test';

import { buildHtmlPackage } from '../src/services/exportHtmlPackage.ts';
import { omiJsonFileName, serializeOmiJson } from '../src/services/exportOmi.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('core portable export payloads have stable filenames and serializable content', async () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.title = 'Árvíztűrő tükörfúrógép';

  assert.equal(omiJsonFileName(manuscript), 'arvizturo-tukorfurogep.omi.json');
  assert.equal(JSON.parse(serializeOmiJson(manuscript)).id, manuscript.id);

  const html = await buildHtmlPackage(manuscript);
  assert.equal(html.validForExport, true);
  assert.match(html.fileName, /\.html\.zip$/);
  assert.ok(html.bytes.byteLength > 0);
});
