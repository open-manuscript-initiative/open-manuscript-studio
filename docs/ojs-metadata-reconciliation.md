# Selective OJS metadata reconciliation

## Architecture reconciliation — 2026-11-18

Canonical Studio routes now use `/api/v1`; matching old routes are compatibility facades over the same handlers. See [ADR-037](architecture/adr-037-editorial-production-and-connector-contract.md) for authority, repository/CAS, connector capabilities, exact proof gate, compatibility and rollout decisions. The checked transport contract is [editorial-v1.openapi.json](api/editorial-v1.openapi.json). This proposed repair is not a new migration, full connector freeze or deployment acceptance.

This increment requires OJS 3.5 with Studio Integration **1.8.0.0**. It uses the
existing registered publishing connection and the current user's personal OJS
editor API credential. It is OJS-only; OMP continues to use its existing workflow.
No database migration or automatic publication is introduced.

Open the OJS destination panel and choose **Compare with OJS**. Select the exact
native metadata language, compare values, then choose a direction for each field.
All fields initially retain both values. The import and send buttons act only on
fields selected for their own direction. Refresh or local manuscript changes
clear the selections. After metadata edits, inspect the artifact destination
again before sending files, because its workflow token may have become stale.

| Field | OJS → OMI | OMI → OJS |
| --- | --- | --- |
| Title, subtitle | Selected manuscript language | Selected manuscript language |
| Abstract, keywords | Selected locale | Selected locale, with native edit permission |
| License URL, copyright holder/year | Explicit selected import | Not supported |
| Ordered contributors, ORCID, affiliation | Display for comparison | Not supported |
| DOI, issue, pages, publication date | Read-only OJS display | Not supported |
| References | Read-only OJS display | Not supported |

OMI currently has one primary title/subtitle. Secondary-language title edits are
therefore disabled. Abstract and keyword translations preserve the primary
compatibility values and other language maps. Missing remote values never fall
back to another language or silently clear the local value. Locale spelling
aliases are normalized; conflicting aliases must be resolved before transfer.
Abstracts are compared as plain text. Sending an abstract replaces formatting of
that language with escaped plain text and line breaks; the panel discloses this
before selection. Other native language variants remain unchanged.

An import rereads OJS and verifies its token, then atomically checks that the
local manuscript has not changed during the request. Selected changes become a
normal OMI checkpoint, survive .omi reopen and can be reverted. Manuscript body,
contributors, local identities and unselected fields remain intact.

The server accepts only the four writable fields and a supported locale, tied to
the inspected submission ID, current publication ID and state token. The plugin
rechecks current-stage editorial access and native `canEditPublication`, permits
only unpublished queued publications, locks the native submission/publication,
validates through the native publication repository and emits `MetadataChanged`.
It merges only the selected locale and retains all other localized values.
A later native change rejects a proposal with 409. The client refreshes and asks
for new selections. A lost response is never automatically replayed.

The metadata proxy uses only an owned enabled OJS connection and a registered,
validated destination. Input URLs and shared integration secrets cannot replace
personal editorial credentials. Public contributor data is allowlisted; emails
and private authorization properties are excluded from the comparison response.

Run `npm run test:ojs-metadata`, `npm run lint`, client/server typechecks and the
plugin PHP CI suite. Automated tests cover selective languages, immutable input,
revision/revert/reopen, concurrent local edits, connection ownership, malformed
proposals, stale native tokens, native validation and redacted upstream errors.
A disposable real OJS acceptance run is still required: compare in two editor
sessions, modify one native field between compare and apply, confirm 409, repeat
with refreshed selection, and verify other locales, native event behavior and
unpublished state. PHP repository doubles do not replace that live evidence.

Still pending: contributor identity/affiliation reconciliation, reference write
proposals, event-driven refresh, OJS copyediting task handoff and external
editorial acceptance receipts. This feature does not certify the complete OJS
editorial lifecycle or grant an external peer-reviewed seal.
