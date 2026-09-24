# Open Manuscript Studio translation master

This directory is generated from the current Studio source tree.

Run:

```sh
npm run i18n:translation-master
```

The command regenerates the supplemental source inventory first, including
component-level dictionaries, detailed help and direct user-interface literals,
then combines it with the canonical English Studio dictionary.

Generated files:

- `studio-translation-master.csv` — authoritative key-level translation table.
  Use this when the same English wording needs different translations in
  different UI contexts.
- `studio-translation-glossary.csv` — deduplicated convenience glossary with
  one row per unique English source string and all occurrence keys listed.
- `studio-translation-master.json` — machine-oriented round-trip format for
  importing completed translations back into Studio.
- `studio-translation-glossary.json` — machine-readable deduplicated glossary.
- `languages.csv` — Studio locale identifiers and the corresponding DeepL
  language names/codes where DeepL supports the language.

## Translator rules

1. Translate only the target-language columns or `translations` values.
2. Never change `id`, `sourceGroup`, `key`, `source`, `kind`,
   `surface` or `sourceFile`.
3. Preserve every item listed in `protectedTerms`, including placeholders,
   URLs, identifiers, product names and file extensions.
4. English is the reference language and therefore is not a target column.
5. The DeepL names/codes in `languages.csv` are authoritative for the existing
   translation workflow. A locale marked unsupported must not be assigned an
   invented DeepL target code.
6. When identical English text needs different grammar in different contexts,
   fill the key-level master rather than relying on the deduplicated glossary.
7. `direct-ui-literal` rows come from a deliberately conservative source scan. If a row is clearly a technical identifier (for example a CSS custom property) rather than visible UI copy, leave its translation blank; it will be reviewed when the returned master is imported.

When completed files are returned, the stable keys allow the translations to be
applied back to PO/JSON dictionaries and the remaining source-level literals
without guessing which screen a string belongs to.
