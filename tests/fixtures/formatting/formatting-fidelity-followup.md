# Formatting fidelity: export, editing and rendered PDF

Follow-up to the canonical 107-case corpus. This PR is additive and does not change source fixtures, publication validators, or production formatting code.

## Native imported marks and language

`formatting-export-contract.ts` uses the original DOCX master fixture and the production importer. For C01/C02/C03/C07/C09/C11/C12 it asserts the actual sample markup in HTML, JATS and PDF print HTML, the IDML applied style and its definition, and the ODT style plus reimported mark. For N01–N06 it asserts language on the actual sample, including IDML AppliedLanguage and an ODT roundtrip acceptance contract. N09 asserts the manual line break in HTML, PDF source, ODT and JATS (JATS is semantic, not visual).

ODT small caps, super/subscript and inline language are explicit executing TODOs until supported; set OMI_FORMATTING_STRICT=1 to make them blocking. No TODO counts as a pass. These are exact format assertions for this subset, not full 107-case export conformance.

## Real PDF output

`vivliostyle-pdf.test.ts` adds OMI-native specimens corresponding to F04/T04: a long note and an 85-row table. It runs the actual pinned renderer and Poppler pdftotext -bbox, then asserts the following:
- long note begins on the anchor sheet, continues to another page, preserves numbered note/body tokens without duplication and keeps tested body/footnote bounding boxes separate;
- table spans at least two sheets, every row and value remains paired and unique, columns do not overlap, and headers repeat above the rows.

These are renderer acceptance checks, not proof that imported Word pagination settings are retained. Both run under OMI_RUN_VIVLIOSTYLE_SMOKE=1. Until confirmed, the two are explicit TODOs, strict mode makes them blocking. Bounding boxes are text-based, not pixel comparison; figures, backgrounds, all line geometry and actual visual hyphenation still need their own tests.

## Browser editing

`e2e/formatting-import-edit.spec.ts` independently authors a compact DOCX with seven real Word character properties. In 1440px and 393px Chromium viewports, the tests import it, select text, inspect toolbar state, remove and reapply each mark, clear compound marks, and verify other paragraphs stay unchanged. They are added to the existing no-retry publication/selection CI step. This is mobile web viewport coverage, not native Android/iOS validation. Full 107-case interactive coverage is still pending.

## Run

```sh
node --test --experimental-strip-types --import ./tests/register-ts-extension-loader.mjs tests/docx-manuscript-fidelity.test.ts
npx playwright test e2e/formatting-import-edit.spec.ts --project=desktop-chromium --workers=1 --retries=0
OMI_RUN_VIVLIOSTYLE_SMOKE=1 npm run test:vivliostyle-pdf
```

The real PDF suite requires the existing Chromium/Vivliostyle/Poppler CI environment. No local complete test run is claimed. Keep known acceptance gaps until exact assertions pass; never replace them with marker-only assertions.
