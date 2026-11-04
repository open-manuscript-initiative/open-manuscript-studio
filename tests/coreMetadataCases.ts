import assert from 'node:assert/strict';
import {
  createPersonAgent, isValidOrcid, normalizeRorId, updatePersonAgent,
  type OmiExternalIdentifierAssertion,
} from '../src/model/identity.ts';
import { createInitialVersioningEnvelope, extractManuscriptState } from '../src/model/versioning.ts';
import { validateStudioManuscript } from '../src/services/manuscriptValidation.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { setOjsOpenScienceField, setScholarlyLocalizedText } from '../src/app/scholarlyMetadataActions.ts';
import type { OmiManuscript } from '../src/types/omi.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

export const metadataSpecifications = {
  'OMI-SPEC-000': '0.2.0', 'OMI-SPEC-120': '0.3.0', 'OMI-SPEC-140': '0.2.0',
};
const T0 = '2026-10-31T12:00:00Z', T1 = '2026-11-04T12:00:00Z';
const ORCID = '0000-0002-1825-0097', OTHER_ORCID = '0000-0001-5109-3700';
const ROR = 'https://ror.org/01jsq2704', OTHER_ROR = 'https://ror.org/03yrm5c26';

function evidence(scheme: 'orcid' | 'ror', value: string): OmiExternalIdentifierAssertion {
  return { id: `${scheme}-assertion`, scheme, value, normalizedValue: value,
    verificationStatus: 'verified', source: 'urn:example:independent-evidence',
    assertedAt: T0, visibility: 'restricted' };
}
function agentFixture() {
  const agent = createPersonAgent({ givenName: 'Ada', familyName: 'Scholar', affiliation: 'Original institution' }, 'agent-author', T0);
  agent.identifiers = [evidence('orcid', ORCID)];
  agent.affiliations[0]!.organizationIdentifier = evidence('ror', ROR);
  agent.affiliations[0]!.source = 'urn:example:affiliation-assertion';
  return agent;
}
function manuscriptFixture(): OmiManuscript {
  const m = createVersionedTestManuscript();
  m.agents = [agentFixture()];
  const state = extractManuscriptState(m);
  return { ...state, ...createInitialVersioningEnvelope(state, { summary: 'Metadata fixture', timestamp: T0, completeness: 'complete' }) };
}
function reopen(m: OmiManuscript) { return parseOmiJson(serializeOmiJson(m)); }

export const coreMetadataCases = [
  {
    id: 'orcid-syntax-is-not-identity-verification', requirements: ['REQ-MET-010', 'REQ-OBJ-014'],
    run() {
      assert.equal(isValidOrcid(ORCID), true);
      const agent = createPersonAgent({ givenName: 'Ada', familyName: 'Scholar', orcid: ORCID }, 'person', T0);
      assert.equal(agent.identifiers[0]!.verificationStatus, 'self-asserted');
      assert.equal(agent.identifiers[0]!.source, undefined);
    },
  },
  {
    id: 'ror-creation-does-not-invent-registry-source', requirements: ['REQ-MET-010', 'REQ-MET-012', 'REQ-OBJ-014'],
    run() {
      assert.equal(normalizeRorId(ROR), ROR);
      const agent = createPersonAgent({ givenName: 'Ada', familyName: 'Scholar', affiliation: 'Typed institution', affiliationRorId: ROR }, 'person', T0);
      assert.equal(agent.affiliations[0]!.organizationIdentifier!.verificationStatus, 'self-asserted');
      assert.equal(agent.affiliations[0]!.organizationIdentifier!.source, undefined);
    },
  },
  {
    id: 'typed-ror-edit-is-only-an-assertion', requirements: ['REQ-MET-010', 'REQ-MET-012', 'REQ-OBJ-014'],
    run() {
      const agent = createPersonAgent({ givenName: 'Ada', familyName: 'Scholar' }, 'person', T0);
      const updated = updatePersonAgent(agent, { affiliation: 'Typed institution', affiliationRorId: ROR }, T1);
      const identifier = updated.affiliations[0]!.organizationIdentifier!;
      assert.equal(identifier.verificationStatus, 'self-asserted');
      assert.equal(identifier.source, undefined);
      assert.equal(updated.affiliations[0]!.source, undefined);
    },
  },
  {
    id: 'unchanged-orcid-retains-exact-evidence', requirements: ['REQ-MET-005', 'REQ-MET-012', 'REQ-OBJ-014'],
    run() {
      const agent = agentFixture(), before = structuredClone(agent);
      const updated = updatePersonAgent(agent, { orcid: `https://orcid.org/${ORCID}` }, T1);
      assert.deepEqual(updated.identifiers, agent.identifiers);
      assert.deepEqual(agent, before);
      assert.equal(updated.identifiers[0]!.id, 'orcid-assertion');
    },
  },
  {
    id: 'changed-orcid-does-not-inherit-verification-or-become-public', requirements: ['REQ-MET-005', 'REQ-MET-010', 'REQ-MET-012'],
    run() {
      assert.equal(isValidOrcid(OTHER_ORCID), true);
      const agent = agentFixture(), updated = updatePersonAgent(agent, { orcid: OTHER_ORCID }, T1);
      const identifier = updated.identifiers[0]!;
      assert.equal(identifier.verificationStatus, 'self-asserted');
      assert.equal(identifier.visibility, 'restricted');
      assert.equal(identifier.source, undefined);
      assert.notEqual(identifier.id, agent.identifiers[0]!.id);
    },
  },
  {
    id: 'unchanged-ror-retains-evidence-and-visibility', requirements: ['REQ-MET-005', 'REQ-MET-012', 'REQ-OBJ-014'],
    run() {
      const agent = agentFixture(), before = structuredClone(agent);
      const updated = updatePersonAgent(agent, { affiliation: 'Original institution', affiliationRorId: '01jsq2704', department: 'Updated department' }, T1);
      assert.deepEqual(updated.affiliations[0]!.organizationIdentifier, agent.affiliations[0]!.organizationIdentifier);
      assert.equal(updated.affiliations[0]!.source, agent.affiliations[0]!.source);
      assert.equal(updated.affiliations[0]!.department, 'Updated department');
      assert.deepEqual(agent, before);
    },
  },
  {
    id: 'replacement-ror-is-not-verified-by-format', requirements: ['REQ-MET-005', 'REQ-MET-010', 'REQ-MET-012'],
    run() {
      const updated = updatePersonAgent(agentFixture(), { affiliation: 'Different institution', affiliationRorId: OTHER_ROR }, T1);
      const identifier = updated.affiliations[0]!.organizationIdentifier!;
      assert.equal(identifier.verificationStatus, 'self-asserted');
      assert.equal(identifier.visibility, 'restricted');
      assert.equal(identifier.source, undefined);
    },
  },
  {
    id: 'unrelated-person-edit-keeps-assertion-metadata', requirements: ['REQ-MET-012', 'REQ-OBJ-014'],
    run() {
      const agent = agentFixture(), updated = updatePersonAgent(agent, { email: 'synthetic@example.invalid' }, T1);
      assert.deepEqual(updated.identifiers, agent.identifiers);
      assert.deepEqual(updated.affiliations, agent.affiliations);
      assert.equal(updated.id, agent.id);
    },
  },
  {
    id: 'assertion-and-visibility-states-survive-portable-round-trip', requirements: ['REQ-MET-005', 'REQ-MET-012', 'REQ-OBJ-014'],
    run() {
      const m = manuscriptFixture();
      m.agents[0]!.identifiers = ['unverified', 'self-asserted', 'verified', 'rejected'].map((status, index) => ({
        ...evidence('orcid', ORCID), id: `state-${index}`, verificationStatus: status as OmiExternalIdentifierAssertion['verificationStatus'],
        visibility: index === 0 ? 'withheld' : 'restricted',
      }));
      const opened = reopen(m);
      assert.deepEqual(opened.agents[0]!.identifiers, m.agents[0]!.identifiers);
      m.agents[0]!.identifiers = [];
      assert.deepEqual(reopen(m).agents[0]!.identifiers, []);
    },
  },
  {
    id: 'inferred-source-attribution-never-becomes-human-confirmed', requirements: ['REQ-MET-005', 'REQ-MET-012', 'REQ-OBJ-014'],
    run() {
      const m = manuscriptFixture();
      m.bibliographicRecords = [{ id: 'source', type: 'other', title: 'Synthetic source', contributors: [], identifiers: [], status: 'provisional' }];
      m.sourceAttributions = ['machine-inferred', 'author-declared', 'author-confirmed'].map((status, index) => ({
        id: `source-claim-${index}`, sourceObjectId: m.sections[0]!.blocks[0]!.id,
        targetBibliographicRecordId: 'source', predicate: 'prov:wasDerivedFrom',
        assertionStatus: status as 'machine-inferred' | 'author-declared' | 'author-confirmed', createdAt: T0,
      }));
      const opened = reopen(m);
      assert.deepEqual(opened.sourceAttributions, m.sourceAttributions);
      assert.equal(opened.bibliographicRecords![0]!.status, 'provisional');
    },
  },
  {
    id: 'metadata-edit-identifies-subject-property-and-value', requirements: ['REQ-MET-001', 'REQ-MET-012'],
    run() {
      const previous = useStudioStore.getState(), m = manuscriptFixture();
      try {
        useStudioStore.setState({ manuscript: m, pendingChangeSet: null });
        setScholarlyLocalizedText('source', 'hu', 'Szerző által megadott forrás');
        const event = useStudioStore.getState().pendingChangeSet!.events[0]!;
        assert.equal(event.operation, 'manuscript.structure.set');
        assert.equal(event.targetId, m.id); assert.equal(event.path, '/metadata/source');
        assert.deepEqual(event.nextValue, { hu: 'Szerző által megadott forrás' });
        useStudioStore.getState().checkpoint();
        const opened = reopen(useStudioStore.getState().manuscript);
        assert.equal(opened.metadata!.source!.hu, 'Szerző által megadott forrás');
        assert.deepEqual(opened.agents[0]!.identifiers, m.agents[0]!.identifiers);
        setOjsOpenScienceField('openData', 'hu', 'Szerzői adatközlés');
        const openScienceEvent = useStudioStore.getState().pendingChangeSet!.events[0]!;
        assert.equal(openScienceEvent.operation, 'manuscript.structure.set');
        assert.equal(openScienceEvent.targetId, m.id);
        assert.equal(openScienceEvent.path, '/extensions/https:~1~1pkp.sfu.ca~1ojs~1/openScience/openData/hu');
        assert.equal(openScienceEvent.nextValue, 'Szerzői adatközlés');
        useStudioStore.getState().checkpoint();
        assert.equal(reopen(useStudioStore.getState().manuscript).extensions!['https://pkp.sfu.ca/ojs/']!.openScience!.openData!.hu, 'Szerzői adatközlés');
      } finally { useStudioStore.setState(previous); }
    },
  },
  {
    id: 'metadata-inspection-does-not-verify-or-rewrite-assertions', requirements: ['REQ-MET-005', 'REQ-MET-012', 'REQ-MET-018'],
    async run() {
      const m = manuscriptFixture();
      m.agents[0]!.identifiers[0]!.verificationStatus = 'unverified';
      const before = JSON.stringify(m);
      await validateStudioManuscript(m);
      assert.equal(JSON.stringify(m), before);
      assert.equal(reopen(m).agents[0]!.identifiers[0]!.verificationStatus, 'unverified');
    },
  },
];

export async function runCoreMetadataCases() {
  const results = [];
  for (const item of coreMetadataCases) {
    await item.run(); results.push({ id: item.id, requirements: [...item.requirements], status: 'pass' as const });
  }
  return results;
}
