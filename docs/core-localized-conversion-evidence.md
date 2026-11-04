# Localized metadata and conversion evidence — 2026-11-04

Twelve scenarios target OMI-SPEC-000@0.2.0 and OMI-SPEC-140@0.2.0. They provide **partial** observations for REQ-MET-011 (language associations and disclosed projection loss), REQ-MET-017 (preservation, normalization, omission and unverified mapping), REQ-PRI-008 (material loss disclosure), and further REQ-MET-018 source preservation evidence.

The OJS normalization path no longer collapses `en-US`/`en-GB`, `de-DE`/`de-AT` or script distinctions. It canonicalizes recognized locale spellings with ECMAScript Intl, translates legacy underscores to hyphens and retains unsupported tags without claiming validation. Conflicting aliases with different normalized values throw `LOCALIZED_METADATA_LOCALE_COLLISION` before returning an imported manuscript; identical normalized values may share their canonical key. The launch object remains unchanged. Text trimming, HTML-to-text behavior and keyword deduplication remain adapter transformations, not lossless guarantees.

Localized editor actions seed a missing primary entry from the legacy scalar projection before adding another language. Existing variants and compatibility scalar values survive edits, checkpoint and portable save/reopen.

DOCX/ODT results now include bounded `metadataConversion` observations for title, manuscript language, primary abstract/keywords, localized abstract/keyword maps and the scholarly metadata object. Actual package XML is inspected by the tests. Non-primary variants and mismatched primary-map values are reported as omitted. Trimming/filtering of the compatibility projection is recorded as normalization; matching primary values are recorded as preserved within this field scope. The source manuscript remains unchanged. Neither adapter invents missing licence or publication facts. The remaining mapping is explicitly unverified.

Omission warnings flow into the existing export report shown in the application. Its downloadable JSON also retains detached typed observations; these contain field locators and codes, not metadata values. Existing warning channels remain unchanged. A receipt still declares incomplete coverage, no lossless guarantee and no assessed round trip.

Run `npm run test:core-localized-conversion`. On a committed checkout, `npm run evidence:core-localized-conversion -- --report test-results/core-localized-conversion.json` executes the same twelve cases and records the exact commit, file hashes, target revisions and requirement mappings. CI runs the suite and uploads its report; the regular core test chain includes it.

The cases do not establish a localized title data model, complete BCP 47 support, complete metadata profiles, every import/export adapter, HTML-to-text correctness, external rights/publication verification, server authorization, independent interoperability or Stable conformance. Existing producer declarations and all specification lifecycle states remain unchanged.
