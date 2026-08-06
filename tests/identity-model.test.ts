import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createContribution,
  createPersonAgent,
  getAgentDisplayName,
  getExternalIdentifierValue,
  getPrimaryAffiliation,
  isValidOrcid,
  normalizeContributionRoles,
  updatePersonAgent,
} from '../src/model/identity.ts';

test('validates ORCID using the MOD 11-2 checksum', () => {
  assert.equal(isValidOrcid('0000-0002-1825-0097'), true);
  assert.equal(
    isValidOrcid('https://orcid.org/0000-0002-1825-0097'),
    true,
  );
  assert.equal(isValidOrcid('0000-0002-1825-0098'), false);
  assert.equal(isValidOrcid(''), true);
});

test('creates a portable person agent independently from an account', () => {
  const timestamp = '2026-08-06T19:45:00.000Z';
  const agent = createPersonAgent(
    {
      givenName: 'Ada',
      familyName: 'Lovelace',
      affiliation: 'Open Manuscript Initiative',
      orcid: '0000-0002-1825-0097',
      language: 'en',
    },
    'agent-1',
    timestamp,
  );

  assert.equal(agent.id, 'agent-1');
  assert.equal(agent.type, 'person');
  assert.equal(getAgentDisplayName(agent), 'Ada Lovelace');
  assert.equal(
    getPrimaryAffiliation(agent),
    'Open Manuscript Initiative',
  );
  assert.equal(
    getExternalIdentifierValue(agent, 'orcid'),
    '0000-0002-1825-0097',
  );
  assert.equal(agent.createdAt, timestamp);
});

test('represents contribution role and order independently from identity', () => {
  const contribution = createContribution(
    'agent-1',
    'manuscript-1',
    ['author', 'methodology'],
    2,
    'contribution-1',
    '2026-08-06T19:45:00.000Z',
  );

  assert.equal(contribution.agentId, 'agent-1');
  assert.equal(contribution.targetId, 'manuscript-1');
  assert.deepEqual(contribution.roles, ['author', 'methodology']);
  assert.equal(contribution.order, 2);
  assert.equal(contribution.corresponding, false);
});

test('normalizes empty and duplicate contribution roles', () => {
  assert.deepEqual(normalizeContributionRoles([]), ['author']);
  assert.deepEqual(
    normalizeContributionRoles(['author', 'author', 'software']),
    ['author', 'software'],
  );
});

test('updates contributor fields without replacing the agent identity', () => {
  const agent = createPersonAgent(
    {
      givenName: 'Sample',
      familyName: 'Author',
      affiliation: 'Old Institution',
    },
    'agent-1',
    '2026-08-06T19:45:00.000Z',
  );

  const updated = updatePersonAgent(
    agent,
    {
      givenName: 'Updated',
      affiliation: 'New Institution',
      orcid: '0000-0002-1825-0097',
    },
    '2026-08-06T19:46:00.000Z',
  );

  assert.equal(updated.id, agent.id);
  assert.equal(getAgentDisplayName(updated), 'Updated Author');
  assert.equal(getPrimaryAffiliation(updated), 'New Institution');
  assert.equal(
    getExternalIdentifierValue(updated, 'orcid'),
    '0000-0002-1825-0097',
  );
  assert.equal(updated.updatedAt, '2026-08-06T19:46:00.000Z');
});
