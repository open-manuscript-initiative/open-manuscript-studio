# OMI Studio DeepL translation batch

This package is generated from the canonical English Studio UI dictionary on 2026-09-21.

## What to translate

- `source-strings.tsv` contains **722 keyed UI strings**.
- The first column (`ID`) is a stable identifier. **Do not translate or alter it.**
- Translate only the **English source** column.
- Return one file per target language, preferably TSV/XLSX with three columns:
  `ID | English source | Translation`.
- Name returned files with the Studio locale code, e.g. `studio-el.tsv`, `studio-ja.tsv`, `studio-zh-TW.tsv`.

The same English text can occur under more than one Studio key. Keep every row; do not deduplicate it.

## Target languages

`target-languages.tsv` lists the **39 locales that still require work**:
16 existing partial catalogues + 23 newly exposed Google Play languages.

The seven catalogues already marked complete in the repository are intentionally not in this batch:
`bg`, `cs`, `da`, `de`, `fr`, `hu`, `it`.

## Terminology / protected names

Keep product names, standards, identifiers and file-format names unchanged unless the target language convention clearly inflects surrounding prose:

Open Manuscript Studio, Open Manuscript Initiative, OMI, OJS, OMP, ORCID, ROR, DOI,
Crossref, DataCite, OpenAlex, MTMT, CSL, JATS, DOCX, IDML, XTG, MIF, SLA, EPUB,
PDF, HTML, XML, JSON, LaTeX, SHA-256, BCP 47, WebAuthn.

Keep keyboard shortcuts and technical examples intact, e.g. `Ctrl/Cmd+Alt+N`,
`https://…`, `.omi.json`, `.omi`.

## Chinese locales

Translate `zh-CN` as Simplified Chinese.
Translate `zh-TW` as Traditional Chinese for Taiwan.
Translate `zh-HK` as Traditional Chinese for Hong Kong.

## Import safety

`source-map.json` maps each stable ID back to the exact JSON Pointer in the Studio dictionary.
When translations are returned, they can therefore be merged without relying on row order.
