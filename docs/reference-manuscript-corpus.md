# Complete reference manuscript corpus

The file tests/fixtures/reference-manuscript-all-features.omi.json is the synthetic reference manuscript used by the Studio 1.0 lifecycle conformance gate.

It is deliberately not a sample article. Its purpose is to exercise as much of the **portable manuscript state** as the current Studio implementation can represent in one deterministic OMI-SPEC-320@0.2.0 working document.

## Lifecycle gate

The reference corpus is tested through:

~~~text
canonical OMI import
        ↓
semantic edit
        ↓
revision commit
        ↓
canonical OMI save
        ↓
close / parse / reopen
        ↓
HTML · JATS · DOCX · EPUB · print-PDF source · interactive-PDF source
~~~

The model/service lifecycle test is tests/reference-manuscript-lifecycle.test.ts.

The browser-level UI lifecycle gate is e2e/reference-manuscript-lifecycle.spec.ts. It opens the committed reference file through Document → Open, edits the real Tiptap surface, exports OMI JSON through Export and tools, closes the document, reopens the downloaded file, and starts the stable publication exports from the same UI.

Run the model/service gate independently with:

~~~bash
npm run test:reference-manuscript
~~~

Run the browser UI lifecycle independently with:

~~~bash
npx playwright test e2e/reference-manuscript-lifecycle.spec.ts --project=desktop-chromium
~~~

Regenerate the committed canonical fixture from the typed builder with:

~~~bash
npm run fixture:reference-manuscript
~~~

The lifecycle tests compare the committed JSON fixture with the builder output and then exercise the same manuscript through both service-level and user-visible browser workflows. A feature change that changes the canonical reference corpus therefore requires an explicit fixture regeneration in the same PR.

## Portable coverage

The fixture includes the currently implemented portable feature families that can coexist in one manuscript:

- canonical OMI-SPEC-320 0.2 envelope and full revision history;
- revision-state digests and deletion tombstone evidence;
- edited-volume structure with multiple studies and nested sections;
- title, subtitle, motto and title-matter fields;
- multilingual abstract, keyword and localized front-matter metadata;
- scholarly subjects, disciplines, agencies, coverage, rights, source, type, data availability, language and publication-venue metadata;
- OJS open-science extension fields;
- person, organization, consortium, project, service and unidentified agents;
- multiple name forms, ORCID, ROR affiliation, biographies and visibility states;
- contributor roles, CRediT roles, corresponding-author state and competing-interest declarations;
- rich text with strong/emphasis/strike/underline/small-caps/super/subscript/code, language spans and links;
- headings, paragraphs, quotations, bullet/numbered lists and code blocks;
- footnotes, endnotes, author notes, comments, editorial annotations and semantic annotations;
- rich-text note bodies and citations inside notes;
- bibliographic records, citation locators/modes/intents and citation clusters;
- internal references to sections, figures, tables, charts and equations;
- named anchors/bookmarks;
- images, tables, charts, equations, MusicXML and MIDI score objects;
- semantic captions with document- and section-scoped numbering;
- figure, supplementary-material, source-data and attachment asset metadata;
- tracked changes in pending, accepted and rejected states;
- every currently implemented publication-correction kind;
- semantic fields with text, rich-text, date, boolean and choice values;
- all computed-field kinds;
- table of contents, figure/table lists, index lists, reference lists and custom generated lists;
- name and subject indexes, hierarchical entries, ranges, See and See also relationships;
- categorized reference lists;
- paragraph-style assignments;
- section numbering, citation style and scholarly-object numbering preferences;
- embedded publication profile, publisher branding, metadata/accessibility rules and output capabilities;
- portable publisher export and print CSS.

The authoritative machine-readable coverage declaration is REFERENCE_MANUSCRIPT_FEATURES in tests/referenceManuscriptFixture.ts.

## Deliberately excluded settings

Some Studio settings are discoverable in the application but are intentionally **not manuscript content**. They must not be serialized into a portable OMI manuscript merely to make the fixture appear more complete.

The corpus therefore excludes:

- passwords, sessions and linked authentication identities;
- institutional and central-administration grants;
- cloud-storage credentials and device-trust state;
- OJS/OMP, reference-manager, AI or translation service secrets;
- per-account interface preferences;
- local filesystem paths;
- saved custom-export templates and other installation/user-local presets.

These exclusions are part of the conformance boundary. A test that finds credentials or account-only state in the portable fixture should fail rather than expanding the fixture.

## Privacy

Every name, e-mail address, URL, identifier, publication venue, citation and manuscript sentence in this corpus is synthetic or reserved for testing. No private manuscript text, production account identifier, local path or credential belongs in the fixture.

## Maintenance rule

When a new portable manuscript feature is added to Studio:

1. add it to the typed reference builder where it can coexist safely with the existing corpus;
2. add an explicit coverage assertion;
3. regenerate the canonical .omi.json fixture;
4. run the lifecycle test and normal 1.0 readiness workflow;
5. document the feature here if it introduces a new feature family.

If a feature cannot coexist in one document because two options are mutually exclusive, keep one representative value in the main manuscript and test the alternatives in focused model tests. The reference corpus is an integration baseline, not a substitute for exhaustive unit tests of every enum value.
