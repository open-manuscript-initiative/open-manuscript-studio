import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluatePublicationReleaseGates,
} from '../scripts/publication-release-gates.ts';

test('the committed publication release gates pass structural policy checks', async () => {
  const result = await evaluatePublicationReleaseGates();

  assert.equal(
    result.passed,
    true,
    JSON.stringify(result.gates, null, 2),
  );
  assert.equal(result.target.standard, 'NISO JATS');
  assert.equal(result.target.version, '1.4');
  assert.equal(result.target.tagSet, 'articleauthoring');
  assert.ok(result.capabilities.total > 0);
  assert.equal(
    result.gates.every((gate) => gate.status === 'pass'),
    true,
  );
});
