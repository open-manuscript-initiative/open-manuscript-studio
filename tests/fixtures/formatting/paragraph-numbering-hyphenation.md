# Paragraph style, numbering and hyphenation contracts

This follow-up to the 107-case formatting corpus adds tests without changing production behavior.

- P01–P11/P15–P19: OMI publication style inheritance, explicit overriding and reset, resolved geometry, line spacing, widow/orphan and keep rules, print hyphenation, and the distinction between justified print and left-aligned HTML.
- S03–S05: named styles and next-style references survive style normalization; IDML contains the assigned style, inheritance relationship, next style, and exact point values. The browser test creates and edits styles, changes inherited values, edits numbering settings and clears overrides through the publication editor. Actual Enter-key next-style application is a separate remaining acceptance criterion.
- L06: import the independent advanced DOCX specimen and verify three-level list nesting in HTML, JATS and ODT.
- L07–L09: execute exact native DOCX numbering restart, custom format and Roman number assertions. They are explicit expected-TODO contracts until native numbering roundtrip is implemented; OMI_FORMATTING_STRICT=1 makes them blocking. Retaining numbering metadata is not proof of correct visual numbering.
- P19: Hungarian, German, British English and American English dictionaries produce actual discretionary break offsets; repeated processing is reversible. Unsupported languages leave text intact. The browser test verifies language-scoped print HTML, disabled paragraphs, and protected links and code.
- The browser tests run in a dedicated no-retry CI step. They cover desktop Chromium; native mobile testing and full editing coverage remain pending.

## Run

```sh
node --test --experimental-strip-types --import ./tests/register-ts-extension-loader.mjs tests/publication-paragraph-style-model.test.ts tests/docx-manuscript-fidelity.test.ts
npx playwright test e2e/publication-paragraph-formatting.spec.ts --project=desktop-chromium --workers=1 --retries=0
```

## Scope

The tests distinguish model metadata, exact CSS/XML mappings and browser interactions. They do not establish rendered PDF page-break fidelity, correct glyph-level hyphenation, exact versus minimum Word leading, full ODT/Word style mapping, or complete 107-case UI coverage. Existing TODO expectations are not weakened, and no full test run is claimed before CI reports its result.
