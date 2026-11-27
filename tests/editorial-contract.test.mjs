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
  const connector = '/api/v1/integrations/connections/{connectionId}';
  for (const [path, operationId, request, response] of [
    ['omp-metadata', 'reconcileOmpVolumeMetadata', 'OmpMetadataRequest', 'OmpMetadataResponse'],
    ['omp-workflow-status', 'inspectOmpEditorialWorkflow', 'WorkflowRequest', 'OmpWorkflowResponse'],
    ['chapter-page-range', 'reconcileOmpChapterPages', 'OmpChapterPagesRequest', 'OmpChapterPagesResponse'],
    ['issue-page-range', 'reconcileOjsIssuePages', 'OjsIssuePagesRequest', 'OjsIssuePagesResponse'],
  ]) {
    const operation = contract.paths[`${connector}/${path}`].post;
    assert.equal(operation.operationId, operationId);
    assert.equal(operation.requestBody.content['application/json'].schema.$ref, `#/components/schemas/${request}`);
    assert.equal(operation.responses['200'].content['application/json'].schema.$ref, `#/components/schemas/${response}`);
    assert.ok(contract.components.schemas[request]);
    assert.ok(contract.components.schemas[response]);
  }
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


test('printed page contract rejects unconfirmed changes, foreign receipts and invalid pagination', async () => {
  const { ojsIssuePagesRequest, validateOjsIssuePagesResponse } = await import('../server/dist/contracts/ojsIssuePagesContract.js');
  const identity = { installationId: 'journal', contextId: 1, issueId: 4, submissionId: 12, publicationId: 13 };
  const input = { ...identity, action: 'apply', firstPrintedPage: 101, lastPrintedPage: 118, expectedWorkflowToken: 'a'.repeat(64), confirmed: true };
  const snapshot = { ...identity, protocol: 'omi-issue-page-range/1', pages: '101-118', workflowToken: 'b'.repeat(64), published: false };
  const receipt = { ...snapshot, previousPages: null, previousWorkflowToken: input.expectedWorkflowToken, unchanged: false };
  assert.equal(ojsIssuePagesRequest.safeParse(input).success, true);
  assert.equal(ojsIssuePagesRequest.safeParse({ ...input, confirmed: false }).success, false);
  assert.equal(ojsIssuePagesRequest.safeParse({ ...input, firstPrintedPage: 119 }).success, false);
  assert.equal(ojsIssuePagesRequest.safeParse({ ...input, firstPhysicalPage: 3 }).success, false);
  assert.doesNotThrow(() => validateOjsIssuePagesResponse(input, { snapshot, receipt }));
  assert.throws(() => validateOjsIssuePagesResponse(input, { snapshot, receipt: { ...receipt, publicationId: 99 } }));
  assert.throws(() => validateOjsIssuePagesResponse(input, { snapshot, receipt: { ...receipt, previousWorkflowToken: 'c'.repeat(64) } }));
  assert.throws(() => validateOjsIssuePagesResponse(input, { snapshot, receipt: { ...receipt, unchanged: true } }));
});
