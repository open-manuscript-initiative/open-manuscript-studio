import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { editorialOpenApi } from '../server/dist/contracts/editorialOpenApi.js';
import { productionCommandSchema } from '../server/dist/contracts/editorialProductionContract.js';

test('published editorial API snapshot is generated from current transport DTOs', () => {
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL('../docs/api/editorial-v1.openapi.json', import.meta.url),
      ),
    ),
    editorialOpenApi(),
  );
  const contract = editorialOpenApi();
  assert.ok(
    contract.paths['/api/v1/native-editorial/production/{submissionId}'],
  );
  assert.ok(
    contract.paths[
      '/api/v1/integrations/connections/{connectionId}/editorial-capabilities'
    ],
  );
  assert.equal(
    productionCommandSchema.safeParse({ command: { type: 'READY' } }).success,
    false,
  );
  assert.equal(
    productionCommandSchema.safeParse({
      version: 0,
      command: { type: 'READY', editor: true },
    }).success,
    false,
  );
});
