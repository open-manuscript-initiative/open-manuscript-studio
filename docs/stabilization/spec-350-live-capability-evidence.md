# OMI-SPEC-350: live Studio evidence and localized limitations

Status: **implementation evidence, not certification**. This change does not approve Draft specifications or advance their normative lifecycle.

## User-facing checks

The Validation page keeps the existing collapsed capability limitations and the seven deterministic synthetic model tests unchanged. A separate **Check selected server** action performs read-only, no-cache requests against the server selected by the shared Studio API transport (including native bearer-session handling):

| Probe | Endpoint | Verified observation | Explicitly not verified |
| --- | --- | --- | --- |
| Server/DB | `GET /api/health` | Studio service response and database connectivity | worker queues, ingress readiness, all API resources |
| Collaboration | `GET /api/collaboration/status` | collaboration enabled on the API node | manuscript membership, WS reachability, segment grants or federation |
| Extension API | `GET /api/v1/integrations/extensions/capabilities` | authenticated version 1 scope contract and conservative permission flags | a general OMI object API, writes, execution, publishing |
| Extension registry | `GET /api/v1/integrations/extensions` | readable session-scoped registry list | plug-in execution, isolation or manuscript authorization |

If a manuscript is open, the same action also runs Studio's **real OMI-SPEC-180 exchange-profile structural validator** against its current snapshot, including identifiers, references, anchors, history, translations, portability and assets. The report contains only the outcome, diagnostics counts, check statuses and source state digest, **not** the manuscript text, title, source files, API response bodies, registry contents, token or cookies.

Findings distinguish **pass** (expected operational response), **fail** (disabled or incompatible), and **unavailable** (no authentication, endpoint missing, server error or network failure). In particular, unauthenticated reads cannot be interpreted as support. Source changes or server/build changes make the displayed session report stale, requiring recheck.

A report is bound to build/dependencies, platform, selected origin and timestamp; its content digest detects accidental changes but is **not a digital signature**. No capability is promoted to `supported` by an endpoint ping; the original `partial` / `conditional` declarations and explicit prerequisites remain separate from observed operational status.

## Localization

- Runtime actions, result explanations, probe labels and scope are available in Hungarian, English and German through the existing `exchangeCopy` mechanism.
- The six capability entries' prerequisite and limitation lines are fully translated for Hungarian and German, with English protocol declarations retained in exported JSON. All other locales currently use an English fallback pending their translated catalogs. This is deliberately visible instead of creating unreviewed machine-translated legal/technical wording.

## Evidence and release gates

1. `npm run test:draft-models` covers version-bound server response contracts, no false-positive on disabled/auth-required/offline/incompatible services, report digest/currentness, registry privacy and manuscript-exchange evidence.
2. `npm run build` and `npm run lint` must be green before merging.
3. After deployment, sign in to the selected server, open a real manuscript, run **Check selected server**, inspect the individual results and save the JSON evidence. Run the original synthetic suite separately for model-gating regression evidence.
4. For server checks against an offline/local or differently configured deployment, report **unavailable**; never silently substitute `studio.openmanuscript.org` or claim the selected endpoint is healthy.
5. WebSocket authorization, real DOCX/ODT roundtrips, publication semantics, external connector contracts and independent conformance remain separate release gates. The server discovery endpoint alone is not sufficient to close OMI-SPEC-190/300/310/340/350.

This is a non-destructive capability-evidence feature. It does not enable new plugin code execution, alter authorization, upload a manuscript to a test service, or change release versions.
