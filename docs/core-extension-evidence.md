# Extension and vocabulary preservation evidence — 2026-11-05

Twelve scenarios target OMI-SPEC-000@0.2.0, OMI-SPEC-100@0.2.0, OMI-SPEC-120@0.3.0 and OMI-SPEC-140@0.2.0. They provide **partial** observations for REQ-DOC-014 (identified extension profiles and version gates), REQ-MET-015 (explicit requirements of the selected metadata review profile), and further evidence for REQ-MET-014, REQ-OBJ-013, REQ-MET-018 and REQ-PRI-008.

## Corrected import and disclosure behavior

OJS import previously discarded foreign metadata fields and normalized every Open Science member as localized text, including fields it did not understand. The candidate normalizes only owned metadata/Open Science fields, retains foreign fields, namespace/profile/version declarations and vocabulary terms opaquely, and detaches retained graphs from the launch payload. Editing an imported extension cannot alter the original launch object. Existing known-field normalization remains in place.

DOCX/ODT do not embed the extension graph or its vocabulary declarations. Their existing metadata conversion observations now include an explicit `/extensions` omission, with a warning in the application export receipt and detached typed observations in its downloadable JSON. The report contains neither extension values nor a claim to understand them. It still declares incomplete mapping, no lossless guarantee and no assessed round trip.

## Observed existing boundaries

Portable save/reopen, ordinary metadata edits and checkpoint history retain the tested unknown namespace, profile versions, vocabulary versions, future terms, nested arrays, falsy values and embedded IDs. Extension properties named `id`, `title` or `sections` do not replace core manuscript properties.

A future translation profile remains opaque in portable exchange; the interpretation API refuses it and validation reports skipped/incomplete inspection. An unsupported frame-layout profile is refused without rewriting source. The recognized frame profile retains its exact profile identifier and enforces its declared alignment vocabulary. These are different, disclosed adapter policies; no generic future-profile interpreter is introduced.

The metadata-profile case identifies `urn:omi:profile:core-snapshot-review:0.1.0` and explicitly selects authoring versus exchange mode. Empty titles are allowed in authoring and rejected in exchange, missing manuscript language is diagnosed, and an invented mode is rejected. A foreign extension cannot weaken these core constraints. This is bounded evidence for declared required fields, not complete cardinality or controlled-vocabulary coverage.

Five import/disclosure regressions fail on the preceding implementation and pass with the fixes. Run `npm run test:core-extensions`; on a committed checkout, `npm run evidence:core-extensions -- --report test-results/core-extensions.json` runs the same cases and records commit, source hashes, exact Draft targets and mappings. The dedicated CI workflow uploads fresh evidence and the regular core test chain includes these cases.

All mappings stay partial. Generic namespace/version validation, every extension profile and vocabulary, external profile resolution, interpretation of foreign semantics, every import/export adapter, full metadata profile/cardinality rules, server authorization and independent interoperability remain open. Synthetic example namespaces are preservation fixtures. Existing producer declarations and all specification lifecycle states remain unchanged.
