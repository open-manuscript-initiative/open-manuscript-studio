# Psychology and Medical / Health Sciences

Two opt-in built-in research workspaces use the existing catalog, server installation allowlist, account/workspace-scoped local persistence, localized alphabetical module ordering and explicit sourced excerpt insertion.

Psychology documents instruments, version/language, usage rights, scoring and missing response rules, and researcher-entered psychometric results. Medical / Health Sciences documents study type (including case reports), intervention/comparator/follow-up, endpoints, aggregate outcomes and adverse events. Both capture design, registration, eligibility, methods, analysis references, ethics approval, consent and data sharing statements. They do not calculate diagnoses, instrument scores or psychometric estimates.

Use Statistical Analysis for computations and experimental design; reference the result here. No duplicate statistics engine, patient database, remote provider, new OMI schema or backend persistence is introduced.

## Data boundary

Local JSON is a version-1 module workspace, **not** a portable OMI manuscript. Restore validates discipline and required string fields. Browser local storage is not encrypted patient storage. Only anonymized/aggregate descriptions belong here; no patient/participant identifiers or identifiable case narratives. Workspace JSON export contains all entered fields, including ethics notes: review before sharing.

Only `fields.publicSummary`, its title and explicit source are projected into the existing manuscript selection UI. Raw instrument content, results, ethics/consent records and other fields are excluded. Source and preview approval remain mandatory, and the excerpt is re-read before insertion. The researcher must check the summary for identifying content; this allowlist is not automatic anonymization. No external AI/translation connector receives workspace data.

## Scope and next steps

Initial scope is structured authoring and ethical metadata. Literature search and version-pinned reporting checklists are deferred; no certification of legal compliance, ethics approval or reporting completeness is implied. Existing general manuscript export formats handle inserted summaries. Mandatory source and rights rules for externally imported objects remain unchanged.
