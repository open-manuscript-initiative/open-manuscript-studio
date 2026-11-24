# OMI advanced formatting corpus 2.0

Follow-up to #975 and #976. The original 65-case DOCX and its manifest remain unchanged. This directory adds 42 independent Word specimens, bringing the reference inventory to 107 case IDs.

## Download or regenerate

Extract [omi-advanced-formatting-corpus.zip](omi-advanced-formatting-corpus.zip) for the 42 individual DOCX files, sorted into eight directories. Each file has a unique body marker, one primary feature and any dependent package parts (styles, numbering, footnotes, image, headers, comments, etc.). No external URLs or live services are needed.

The authoritative source is [advanced-cases.json](advanced-cases.json). To regenerate the individual DOCX files:

```sh
node --experimental-strip-types tests/generate-advanced-formatting-fixtures.ts tmp/omi-advanced-formatting
```

The checked-in ZIP contains the same package parts as the generator; a unit test compares each part byte-for-byte, ignoring ZIP timestamps. These are deliberately minimal independently authored OOXML specimens, not Word-generated or Office-certified files.

## Test execution

```sh
node --test --experimental-strip-types --import ./tests/register-ts-extension-loader.mjs tests/docx-manuscript-fidelity.test.ts
```

This is also part of the existing `npm test` chain. Set `OMI_FORMATTING_STRICT=1` to make open native acceptance assertions blocking. Expected TODO assertions run in normal CI but are not evidence of supported fidelity.

The new test contract checks each specimen's native source properties and package relationships, marker retention after import/editor projection/OMI reopening, six export paths (DOCX, ODT, HTML, JATS, IDML and PDF print HTML), and exact native DOCX assertions or review privacy. Eight cases have additional specific model checks. See [omi-export-test-matrix.json](omi-export-test-matrix.json) for the distinction between exact, marker-only and pending checks across all 107 IDs.

## Remaining acceptance gates

- F04: a long footnote with `keepLines=0` is a pagination specimen. Actual continuation, baseline overlap, and completeness require rendered PDF page inspection.
- T04: 85 data rows plus a repeating header; the output must be tested on actual pages before declaring repeated headers and no lost/duplicated rows.
- F07: an OMI inline author note uses a named character-style convention in Word. It is not a native Word note type.
- X12: legacy VML linked text boxes are used for interchange; test Studio-native frame flow separately.
- C26: hidden text must not leak into publication exports. The explicit acceptance assertion remains open where imported hidden-run semantics are not supported.
- R03/R04: retention of private review history in OMI is separate from public export privacy.
- Interactive edit/reset for all 107 IDs, exact ODT/HTML/JATS/IDML mappings and rendered PDF layout remain incomplete. Existing product regression suites continue to run; no prior expectations are weakened.

Do not mark an acceptance case complete until the corresponding production behaviour and test pass. No Office or InDesign rendering engine was used to certify these generated packages.
