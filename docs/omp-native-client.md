# Native OMP 3.5 client

Status: implemented for Open Manuscript Studio with the OMI OMP Integration
Plugin 1.5.0.0 or newer.

## Authority boundary

OMP remains authoritative for press configuration, workflow stage, review round,
reviewer assignment, reviewer completion, editorial decisions, notifications and
native file associations. Studio is an editing client. It caches only the
external identifiers needed to return work to the exact OMP workflow object.

The browser never receives the OMP installation shared secret or the OMP API
base URL used for long-running writeback.

## Launch bootstrap

A short-lived `omi-integration/1/omp` launch assertion is used only to
bootstrap authorized reads:

- monograph/publication metadata;
- contributor data when the launch scope permits it;
- authorized submission files and DOCX source content;
- `platform-capabilities`;
- reviewer `review-context`, native review form and existing reviewer
  attachments;
- author `author-context` when native service writeback is supported.

Studio verifies the launch signature, expiration, nonce replay boundary, role
scope and registered installation origin before requesting OMP data.

## Persisted native context

Studio stores the following only on the server:

- OMP installation ID and API base URL;
- submission and actor IDs;
- reviewer assignment, review-round and assigned chapter IDs;
- author current review-round ID;
- source submission-file and genre IDs when available;
- the capability snapshot that enabled the native action.

The values are preserved as OMP/PKP identifiers; Studio does not renumber or
translate them.

Reviewer contexts are bound to a Studio review assignment. Author contexts use
an opaque one-time context ID which is bound to the authenticated Studio user
when the first revision is sent.

## Reviewer writeback

When the OMP plugin advertises native service writeback, Studio:

1. loads the concrete OMP review context and verifies it matches the signed
   launch assignment;
2. persists the native recommendation capability without inventing
   recommendation choices when OMP does not provide them;
3. stores native review-form state against the Studio assignment;
4. returns a saved Studio review revision as an OMP reviewer attachment;
5. sends comments, review-form responses and any supported native
   recommendation ID through `review-result-v2`.

The Studio service signs each request with the installation ID, bounded
timestamp and HMAC-SHA256 signature. OMP revalidates the submission, reviewer,
assignment and current review round before writing.

Studio does not mark the OMP review complete. Completion and its notifications
remain in the native OMP reviewer workflow.

## Author revision writeback

An OMP author launch receives an author revision action only when:

- the plugin advertises the native service-writeback contract;
- `author-context` identifies a writable current review round;
- the context belongs to the imported OMP manuscript.

The browser exports the current Studio manuscript to DOCX and sends it to the
Studio API. Studio then signs a server-to-server request to the native OMP
`author-revisions` endpoint.

OMP independently verifies that the author is assigned to the current workflow
stage, the requested round is the latest round, and the round contains a native
decision permitting an author revision. Studio cannot bypass these checks by
altering the stored external identifiers.

## Backward compatibility

OMP plugin 1.4.x continues to support the pre-existing launch and reviewer
comment/form writeback flow. Studio discovers capabilities before enabling the
new native write actions. The 1.5 native path is therefore activated by the
server capability contract rather than by a client-side version guess.

## Security invariants

- no OMP shared secret is sent to the browser;
- no OMP write URL is accepted from browser input;
- remote URLs must match the registered OMP installation origin;
- reviewer mode never gains contributor or reviewer-identity scopes;
- native recommendation IDs are accepted only when OMP supplies them;
- stale, cross-submission, cross-assignment and cross-round writes are rejected
  by OMP;
- Studio never becomes the review-completion or editorial-decision authority.
