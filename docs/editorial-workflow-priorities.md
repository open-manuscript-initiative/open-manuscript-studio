# OJS / OMI editorial workflow: ordered delivery and acceptance

This plan separates implemented Preview functionality from remaining connector
work. It follows the complete workflow from submission to publication, while
retaining OJS as the authority for connected journals.

## Priority order

| Priority | Deliverable | Current implementation / next acceptance gate |
| --- | --- | --- |
| 1 | Revision lineage and copyediting | Native production archives the accepted source; edited source requires author/editor approval and a new exact editorial acceptance. Verify on PostgreSQL and with distinct native author/editor accounts. |
| 2 | Proof correction and final approval | Native located corrections, recorded dispositions, immutable proofs and exact-file approvals are implemented. HTML/PDF use the existing renderers. Verify browser/native delivery and approval invalidation. |
| 3 | Stage-scoped permissions | Native COPYEDITOR/LAYOUT_EDITOR/PROOFREADER tasks are implemented. OJS task mapping and native copyediting/proof writeback remain separate connector work; broad Assistant role names are insufficient. |
| 4 | OJS state and metadata reconciliation | Stage refresh, stale-transfer protection and selective two-way title/subtitle/abstract/keyword reconciliation are implemented. License/copyright can be explicitly imported. Contributor identity reconciliation, identifier mapping and automatic event updates remain separate work. See `ojs-metadata-reconciliation.md`. |
| 5 | Complete acceptance evidence | Unit/HTTP/PHP contracts and PostgreSQL/browser CI tests are supplied. A disposable real OJS 3.5 workflow run is still required before operational certification. |
| 6 | External editorial evidence | The contract below is specified; OJS acceptance must not be treated as a Studio-native decision. No external reviewed seal is enabled by this change. |
| 7 | Native issue management | Design below; OJS already provides this for connected journals. Native volumes/issues, article ordering, issue publication and reader/archive services are not implemented here. |

## OJS stage-task connector contract (priority 3)

An OJS task handoff must identify installation, context, submission, current
publication, workflow stage, native stage assignment/user group, actor and exact
source file. Studio must verify the native assignment before listing or fetching
files and again before writeback. Display labels such as "Copyeditor" are not
authorization evidence.

Copyediting source returns must create native OJS copyediting-stage file records;
proof files must use native production/proof associations. No review-round upload
endpoint may be reused for copyediting. Returned artifacts remain unpublished.
Task closure and source/proof approval must use OJS's native workflow semantics;
they must not silently advance the editorial stage or approve a galley.

Acceptance cases: same assistant on two submissions; only one assigned;
assignment revoked after launch; stage changes before writeback; old publication
version; wrong file association; retries; cross-context request; valid assigned
copyeditor and proofreader. Denial must leave no file residue.

## Metadata reconciliation contract (priority 4)

Each comparison must identify the OJS publication version and a native snapshot
revision token. The OMI manuscript version and selected locale must also be
explicit. A metadata proposal is reviewed field by field: title/subtitle,
abstract, keywords, ordered contributors and affiliations, references, license,
rights, issue/pages, date and persistent identifiers.

The connector must disclose the authority for each field. OJS owns its registered
DOI, issue assignment, native publication status and publication date. Studio may
propose manuscript metadata, but must not silently overwrite later OJS edits.
Contributor IDs, ORCID evidence and localized values must preserve their native
identities rather than being matched only by display names.

Submission ID + publication ID + locale + expected revision token are required
for applying a proposal. An intervening change returns 409 with a refreshed
comparison. Publication callbacks/webhooks may invalidate a cached projection;
the client must then re-read native state. A callback is not authority to make an
editorial decision. The current increment uses explicit refresh and per-field proposals, documented in `ojs-metadata-reconciliation.md`. Contributor/reference writes and event-driven refresh remain unimplemented.

## Real OJS acceptance run (priority 5)

Use a disposable journal and distinct author, reviewer, editor, copyeditor and
layout/proof accounts. Record exact OJS/plugin/Studio versions and commit SHAs.

1. Submit from Studio; verify native metadata, files and author notification.
2. Execute round 1, including required native form fields, native recommendation,
   confidential editor-only feedback and reviewer-returned file.
3. Request a revision, return the author file, open round 2 and check assignment,
   file and response isolation. Use `pkp-ojs-two-round-e2e.md` for negative tests.
4. Accept in OJS, move through copyediting and production, and document which
   operations are native OJS and which are Studio operations.
5. Inspect publication metadata, prepare HTML/JATS/PDF, change OJS metadata in a
   second session and verify that token-bound transfer returns 409.
6. Reinspect and transfer. Confirm the galley remains unapproved/unpublished;
   retry without duplicating the logical galley; change bytes and retain proof
   history. Confirm native final-proof approval and author communication in OJS.
7. Assign the article to an issue, set pages/DOI as required by the journal,
   preview and publish using OJS. Verify reader view, metadata and native archive.
8. Reopen the Studio projection and compare the reported current OJS state.

For every step retain sanitized IDs, timestamps, pass/fail, CI URLs, screenshots
or redacted traces. Missing live steps remain NOT RUN, never PASS. A green plugin
load/packaging test does not certify this workflow.

## External OJS editorial evidence adapter (priority 6)

A future connector-specific receipt must bind:

- verified installation and context;
- native submission and exact publication version;
- native acceptance decision ID/type/time and authorized editor;
- review round and review method, without reviewer identities or confidential text;
- the accepted source file/revision and its digest;
- the artifact build/digest that derives from it;
- connector version, receipt expiry/revalidation rule and authenticity evidence.

Read it through an authorized server-to-server/native OJS endpoint and verify
current state again before issuing an assurance grant. A browser JSON claim or a
completed reviewer assignment alone is insufficient. The assurance authority
must be explicitly external OJS, separate from `studio-editorial-decision`.

Changed accepted content requires a new external decision or explicit native
editorial approval chain; withdrawal/retraction/unpublication must invalidate
further delivery grants. Test forged receipts, another journal/version, expired
receipts, later editorial changes and reviewer-data leakage. Until implemented,
keep the external-workflow reviewed-seal path disabled.

## Native issue management (priority 7)

For venues without OJS, model an issue separately from manuscripts: venue ID,
volume/number/year, localized title, cover, sections, ordered article publication
IDs, page ranges, issue-level artifacts and planned/actual publication dates.
Use DRAFT → SCHEDULED → PUBLISHED, with a separate recorded unpublish action.

An issue can contain only READY articles accepted for the same venue. Publishing
must use an explicit immutable issue manifest and a recoverable outbox; partial
website failure must not mark undelivered articles published. Stable URLs and
identifier registrations need their own receipts. Reader pages, archives and
OAI-PMH/DOI deposit adapters are separate capabilities and must not be claimed
merely because the issue can be exported as JSON or HTML.

This layer must reject an authoritative OJS binding so there cannot be two
competing issue schedules for the same journal.


## 2026-11-18 boundary checkpoint

Use the common `omi-publishing-editorial/1` capability projection and the canonical v1 connection endpoints. OJS profile snapshots remain versioned extensions; OMP explicitly lacks these two new operations until a tested adapter exists. New endpoint availability does not imply native task writeback, proof approval or external reviewed-seal authority. [ADR-037](architecture/adr-037-editorial-production-and-connector-contract.md) and the generated OpenAPI describe the bounded implementation. The existing exact-candidate OJS manual gates must exercise these operations with exact Studio/plugin/package identities; helper tests and native package installation alone do not certify the editorial workflow.
