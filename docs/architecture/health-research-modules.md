# Psychology and Medical / Health Sciences

Two opt-in built-in research workspaces use the existing catalog, server installation allowlist, account/workspace-scoped local persistence, localized alphabetical module ordering and explicit sourced excerpt insertion.

Psychology documents instruments, version/language, usage rights, scoring and missing response rules, and researcher-entered psychometric results. Medical / Health Sciences documents study type (including case reports), intervention/comparator/follow-up, endpoints, aggregate outcomes and adverse events. Both capture design, registration, eligibility, methods, analysis references, ethics approval, consent and data sharing statements. They do not calculate diagnoses, instrument scores or psychometric estimates.

Use Statistical Analysis for computations and experimental design; reference the result here. No duplicate statistics engine, patient database, remote provider, new OMI schema or backend persistence is introduced.

## Data boundary

Local JSON is a version-1 module workspace, **not** a portable OMI manuscript. Restore validates discipline and required string fields. Browser local storage is not encrypted patient storage. Only anonymized/aggregate descriptions belong here; no patient/participant identifiers or identifiable case narratives. Workspace JSON export contains all entered fields, including ethics notes: review before sharing.

Only `fields.publicSummary`, its title and explicit source are projected into the existing manuscript selection UI. Raw instrument content, results, ethics/consent records and other fields are excluded. Source and preview approval remain mandatory, and the excerpt is re-read before insertion. The researcher must check the summary for identifying content; this allowlist is not automatic anonymization. No external AI/translation connector receives workspace data.

## Scope and next steps

Initial scope is structured authoring and ethical metadata. Version-pinned reporting checklists are deferred; no certification of legal compliance, ethics approval or reporting completeness is implied. Existing general manuscript export formats handle inserted summaries. Mandatory source and rights rules for externally imported objects remain unchanged.


## International database search

Both modules declare `health-research.search`. Studio's additive API-v1 endpoints are `POST /api/v1/modules/psychology/health/search` and `POST /api/v1/modules/medical-sciences/health/search`, with nonconfidential `workspaceId` as a query parameter and strict body `{provider, query, cursor?}`. Supported providers are `pubmed`, `europe-pmc`, `clinical-trials`. Results contain bounded metadata, total count, and provider-specific next cursor. Body queries are not placed in Studio request URLs, audited, stored in workspace JSON, or derived automatically from manuscript/protocol fields.

Session, installation allowlist, workspace activation and declared server capability are enforced before external execution. Provider selection persists separately per account/workspace/module; an empty selection is respected. Each provider's failure is isolated in the UI. Responses are no-store. Fixed HTTPS endpoints prohibit arbitrary URL access and redirects; calls have time, byte, query and page bounds. Search is rate-limited. Keyless NCBI starts are limited to below 3/sec within one API process, with a bounded queue. Multiple API processes sharing an egress IP must coordinate that limit externally before scaling; this adapter does not claim a distributed limiter.

PubMed uses ESearch + ESummary; Europe PMC uses the REST `core` result; ClinicalTrials.gov uses API v2, selecting registration metadata rather than participant/contact data. Provider links target individual records, not a database homepage. Rights are shown only when explicitly supplied; open-access access is not inferred to be a reuse licence. Imported references use the existing citation application action and remain provisional. Article full text is never transferred by this search feature. DOI/PMID/reference URL prevent duplicate reference addition. Trial registration and preprint detection do not confer publication assurance or review status.

PsychArchives is an explicitly external, query-bearing browse link (`/en/browse/?q=…`) because a supported public result API was not verified. APA PsycInfo is an explicitly labelled institutional subscription portal, and WHO ICTRP an external registry-search portal; neither pretends to return native Studio results. All links open a new tab. Only the search query goes to selected public providers, with visible user notice; confidential review or patient data must never be entered.

### Provider contracts verified 2026-10-11

- [NCBI E-utilities](https://www.ncbi.nlm.nih.gov/home/develop/api/) and [usage limits](https://www.ncbi.nlm.nih.gov/books/NBK25497/).
- [Europe PMC REST API](https://europepmc.org/RestfulWebService) and [reuse guidance](https://europepmc.org/help).
- [ClinicalTrials.gov API](https://clinicaltrials.gov/data-api/about-api).
- [PsychArchives browse](https://www.psycharchives.org/en/browse/), [APA PsycInfo](https://www.apa.org/pubs/databases/psycinfo), [WHO ICTRP](https://www.who.int/tools/clinical-trials-registry-platform).

Adapter conformance tests use synthetic metadata only. API integration tests enforce session/activation/installation boundaries and audit redaction; browser tests cover provider selection, partial failure, pagination and reference insertion on desktop and mobile.
