import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { createPersonAgent } from '../src/model/identity.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { getCurrentUser, useAuthStore } from '../src/store/authStore.ts';
import { createInitialVersioningEnvelope, extractManuscriptState } from '../src/model/versioning.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { validateStudioManuscript } from '../src/services/manuscriptValidation.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';
import { collaborationDecision, COLLABORATION_ROLE_ACTIONS } from '../server/src/services/collaborationPolicy.ts';
import { findVerifiedFederatedIdentity } from '../server/src/services/verifiedFederatedIdentity.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
import type { OmiManuscript } from '../src/types/omi.ts';

export const authoritySpecifications = { 'OMI-SPEC-000': '0.2.0', 'OMI-SPEC-140': '0.2.0' };
const PRINCIPAL = 'account-author', OTHER = 'different-account';
const ORCID = '0000-0002-1825-0097', T0 = '2026-11-05T00:00:00Z';
type Member = { role: string; revokedAt: Date | null; user: { status: string } };
type Ticket = { id: string; tokenHash: string; documentId: string; userId: string; expiresAt: Date; revokedAt: Date | null };
const memberships = new Map<string, Member>(), tickets = new Map<string, Ticket>();
const queries: unknown[] = []; let writes = 0;
const key = (documentId: string, userId: string) => JSON.stringify([documentId, userId]);
function reset() { memberships.clear(); tickets.clear(); queries.length = 0; writes = 0; }
function member(documentId: string, role: string, userId = PRINCIPAL, status = 'ACTIVE') {
  const row: Member = { role, revokedAt: null, user: { status } };
  memberships.set(key(documentId, userId), row); return row;
}
// Only persistence is replaced. Actual service token generation, hashing,
// membership decisions, current-role rechecks and expiry handling execute below.
mock.module(new URL('../server/src/lib/prisma.ts', import.meta.url).href, { namedExports: { prisma: {
  collaborationMember: { findUnique: async ({ where }: { where: { documentId_userId: { documentId: string; userId: string } } }) => {
    queries.push(structuredClone(where)); const { documentId, userId } = where.documentId_userId;
    return structuredClone(memberships.get(key(documentId, userId)) ?? null);
  } },
  collaborationConnectionTicket: {
    deleteMany: async () => ({ count: 0 }),
    create: async ({ data }: { data: Omit<Ticket, 'id' | 'revokedAt'> }) => {
      writes++; const row = { ...data, id: `ticket-${writes}`, revokedAt: null }; tickets.set(data.tokenHash, row); return structuredClone(row);
    },
    findUnique: async ({ where }: { where: { tokenHash: string } }) => structuredClone(tickets.get(where.tokenHash) ?? null),
    updateMany: async () => ({ count: 0 }),
  },
} } });
const service = await import('../server/src/services/collaborationTicketService.ts');

function fixture(): OmiManuscript {
  const source = createVersionedTestManuscript();
  const agent = createPersonAgent({ givenName: 'Synthetic', familyName: 'Author', email: 'owner@example.org', orcid: ORCID,
    affiliation: 'Synthetic Institution', affiliationRorId: 'https://ror.org/01jsq2704' }, PRINCIPAL, T0);
  agent.identifiers[0]!.verificationStatus = 'verified'; agent.identifiers[0]!.source = 'urn:example:synthetic-identity-evidence';
  source.agents = [agent]; source.contributions = [{ id: 'claimed-author', agentId: agent.id, targetId: source.id,
    roles: ['author', 'editor', 'reviewer'], visibility: 'public', createdAt: T0, updatedAt: T0 }];
  source.metadata = { rights: { en: 'Author-declared open reuse' }, licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    copyrightHolder: { en: 'Synthetic Institution' }, copyrightYear: 2026 };
  source.extensions = { 'urn:example:untrusted-acl:1': { version: '1', role: 'OWNER', principalId: PRINCIPAL, approved: true } };
  const state = extractManuscriptState(source);
  return { ...state, ...createInitialVersioningEnvelope(state, { summary: 'Authority fixture', timestamp: T0, completeness: 'complete' }) };
}
function reopen(source: OmiManuscript) { return parseOmiJson(serializeOmiJson(source)); }
async function within(run: (source: OmiManuscript) => void | Promise<void>) {
  const previous = useStudioStore.getState(), previousAuth = useAuthStore.getState(); reset();
  useAuthStore.setState({ users: [], session: null, isInitialized: true, isLoading: false });
  const source = reopen(fixture());
  try { await run(source); } finally { reset(); useStudioStore.setState(previous); useAuthStore.setState(previousAuth); }
}
async function denied(userId: string, documentId: string) {
  await assert.rejects(service.issueCollaborationConnectionTicket(userId, documentId), { code: 'FORBIDDEN' });
}
export const coreAuthorityCases = [
  { id: 'portable-contributor-orcid-and-affiliation-do-not-create-account-session', requirements: ['REQ-PRI-006', 'REQ-MET-008'], run: () => within(source => {
    const before = structuredClone(source); useStudioStore.getState().loadManuscript(source);
    assert.equal(getCurrentUser(useAuthStore.getState()), undefined); assert.equal(useAuthStore.getState().session, null);
    assert.deepEqual(useAuthStore.getState().users, []); assert.equal(writes, 0); assert.equal(queries.length, 0);
    assert.equal(source.identityModelVersion, 'OMI-SPEC-150@0.1.0'); assert.deepEqual(source, before);
  }) },
  { id: 'matching-contributor-account-id-and-verified-orcid-are-not-membership', requirements: ['REQ-PRI-006', 'REQ-MET-008'], run: () => within(async source => {
    useStudioStore.getState().loadManuscript(source); await denied(PRINCIPAL, source.id);
    assert.deepEqual(queries, [{ documentId_userId: { documentId: source.id, userId: PRINCIPAL } }]);
    assert.equal(writes, 0); assert.equal(tickets.size, 0);
  }) },
  { id: 'open-license-and-portable-owner-claims-do-not-issue-service-ticket', requirements: ['REQ-MET-009', 'REQ-PRI-006'], run: () => within(async source => {
    for (const license of ['https://creativecommons.org/publicdomain/zero/1.0/', 'https://creativecommons.org/licenses/by/4.0/']) {
      source.metadata!.licenseUrl = license; useStudioStore.getState().loadManuscript(source);
      await denied(PRINCIPAL, source.id); assert.equal(writes, 0);
    }
  }) },
  { id: 'viewer-membership-stays-read-only-despite-scholarly-editor-labels', requirements: ['REQ-PRI-006', 'REQ-MET-008', 'REQ-MET-009'], run: () => within(async source => {
    member(source.id, 'VIEWER'); const issued = await service.issueCollaborationConnectionTicket(PRINCIPAL, source.id);
    const access = await service.authorizeCollaborationConnectionTicket(issued.token, source.id);
    assert.equal(access?.readOnly, true); assert.equal(access?.role, 'VIEWER');
    assert.equal((await service.reauthorizeCollaborationSession({ userId: PRINCIPAL, documentId: source.id, expiresAt: Date.now() + 60_000 }, source.id))?.readOnly, true);
    source.contributions[0]!.roles = ['editor']; source.metadata!.rights = { en: 'Full rights claimed' };
    useStudioStore.getState().loadManuscript(source);
    assert.equal((await service.authorizeCollaborationConnectionTicket(issued.token, source.id))?.readOnly, true);
  }) },
  { id: 'collaboration-roles-do-not-imply-editorial-approval-or-rights-clearance', requirements: ['REQ-PRI-006', 'REQ-MET-009'], run: () => within(source => {
    for (const role of Object.keys(COLLABORATION_ROLE_ACTIONS)) {
      const evidence = { principalId: PRINCIPAL, documentId: source.id, role, revoked: false };
      assert.equal(collaborationDecision(evidence, { principalId: PRINCIPAL, documentId: source.id, action: 'approve-or-publish' }).allowed, false);
    }
    for (const role of ['reviewer', 'TRANSLATOR', 'ADMIN', 'constructor', '__proto__']) {
      assert.equal(collaborationDecision({ principalId: PRINCIPAL, documentId: source.id, role, revoked: false },
        { principalId: PRINCIPAL, documentId: source.id, action: 'edit-content' }).allowed, false);
    }
  }) },
  { id: 'account-and-document-scope-cannot-be-replaced-by-portable-attribution', requirements: ['REQ-PRI-006', 'REQ-MET-008'], run: () => within(async source => {
    member(source.id, 'AUTHOR'); await denied(OTHER, source.id); await denied(PRINCIPAL, 'another-document');
    const issued = await service.issueCollaborationConnectionTicket(PRINCIPAL, source.id);
    assert.equal(await service.authorizeCollaborationConnectionTicket(issued.token, 'another-document'), null);
    assert.equal((await service.authorizeCollaborationConnectionTicket(issued.token, source.id))?.readOnly, false);
  }) },
  { id: 'revoked-membership-overrides-identity-and-license-assertions', requirements: ['REQ-PRI-006', 'REQ-MET-008', 'REQ-MET-009'], run: () => within(async source => {
    const row = member(source.id, 'AUTHOR'), issued = await service.issueCollaborationConnectionTicket(PRINCIPAL, source.id);
    row.revokedAt = new Date(); await denied(PRINCIPAL, source.id);
    assert.equal(await service.authorizeCollaborationConnectionTicket(issued.token, source.id), null);
    assert.equal(await service.reauthorizeCollaborationSession({ userId: PRINCIPAL, documentId: source.id, expiresAt: Date.now() + 60_000 }, source.id), null);
  }) },
  { id: 'suspended-account-cannot-use-scholarly-orcid-to-issue-ticket', requirements: ['REQ-PRI-006', 'REQ-MET-008'], run: () => within(async source => {
    member(source.id, 'OWNER', PRINCIPAL, 'SUSPENDED'); await denied(PRINCIPAL, source.id); assert.equal(writes, 0);
  }) },
  { id: 'expired-ticket-cannot-be-renewed-by-copyright-or-affiliation-metadata', requirements: ['REQ-MET-009', 'REQ-MET-008'], run: () => within(async source => {
    member(source.id, 'AUTHOR'); const issued = await service.issueCollaborationConnectionTicket(PRINCIPAL, source.id);
    for (const row of tickets.values()) row.expiresAt = new Date(Date.now() - 1);
    assert.equal(await service.authorizeCollaborationConnectionTicket(issued.token, source.id), null);
    assert.equal(await service.reauthorizeCollaborationSession({ userId: PRINCIPAL, documentId: source.id, expiresAt: Date.now() - 1 }, source.id), null);
  }) },
  { id: 'missing-rights-do-not-become-public-domain-or-service-permission', requirements: ['REQ-MET-009', 'REQ-PRI-013'], run: () => within(async source => {
    delete source.metadata; source.sourceAttributions = []; const result = reopen(source), before = structuredClone(result);
    const output = renderJatsArticle(result);
    assert.ok(!output.xml.includes('<license')); assert.ok(!output.xml.includes('<copyright-holder>')); assert.ok(!output.xml.includes('creativecommons.org'));
    assert.equal(result.metadata, undefined); assert.deepEqual(result, before); await denied(PRINCIPAL, result.id);
  }) },
  { id: 'inspection-does-not-invent-missing-provenance-or-verified-authorship', requirements: ['REQ-PRI-013', 'REQ-MET-008', 'REQ-MET-009'], run: () => within(async source => {
    delete source.metadata; delete source.extensions; source.sourceAttributions = [];
    source.agents = [createPersonAgent({ givenName: 'Unverified', familyName: 'Author', orcid: ORCID }, PRINCIPAL, T0)];
    const result = reopen(source), before = structuredClone(result); await validateStudioManuscript(result);
    assert.equal(result.agents[0]!.identifiers[0]!.verificationStatus, 'self-asserted');
    assert.equal(result.agents[0]!.identifiers[0]!.source, undefined); assert.deepEqual(result.sourceAttributions, []);
    assert.equal(result.metadata, undefined); assert.deepEqual(result, before); await denied(PRINCIPAL, result.id);
  }) },
  { id: 'federated-admin-prerequisite-does-not-trust-scholarly-or-unverified-claims', requirements: ['REQ-MET-008', 'REQ-PRI-006'], run: () => within(() => {
    const email = 'owner@example.org', claims = { email, emailVerified: false, orcid: ORCID, role: 'OWNER', affiliationRorId: 'https://ror.org/01jsq2704' };
    for (const provider of ['ORCID', 'OIDC', 'SAML']) assert.equal(findVerifiedFederatedIdentity(email, [{ provider, profile: claims }]), undefined);
    assert.equal(findVerifiedFederatedIdentity(email, [{ provider: 'OIDC', profile: { ...claims, emailVerified: true, email: 'someone-else@example.org' } }]), undefined);
    const trusted = { provider: 'OIDC', profile: { email, emailVerified: true } };
    assert.equal(findVerifiedFederatedIdentity(email, [trusted]), trusted);
    // A prerequisite helper result is not itself an institution membership grant.
    assert.equal(writes, 0); assert.equal(memberships.size, 0);
  }) },
];
export async function runCoreAuthorityCases() {
  const results = [];
  for (const item of coreAuthorityCases) {
    await item.run(); results.push({ id: item.id, requirements: [...item.requirements], status: 'pass' as const });
  }
  return results;
}
