# OMI Studio translation audit

The canonical translator-facing catalogs are `locale/<locale>/studio.po`.

Run the summary audit with:

```bash
npm run i18n:po:audit
```

To list every translation key whose `msgstr` is still identical to the English `msgid`, run:

```bash
npm run i18n:po:audit:details
```

The audit reports, per locale:

- total expected PO entries;
- translated entries;
- completion percentage;
- empty `msgstr` values;
- values identical to English and therefore requiring review;
- missing, extra, stale or duplicate translation keys;
- whether the locale is declared complete.

## Completion policy

`locale/translation-status.json` controls release completeness.

A locale not listed in `completeLocales` may contain English-identical candidates while translation is still in progress. Structural errors and empty translations are always rejected.

Once a locale has been reviewed and completed, add its locale code to `completeLocales`. From that point the CI audit rejects English-identical entries for that locale unless the specific JSON Pointer is explicitly listed in `identicalAllowlist`.

The allowlist is intended only for genuinely language-independent values such as standards, identifiers or product names. It must not be used to hide untranslated interface prose.

## CI gate

CI performs the following localization checks before the application build:

1. compile PO catalogs to runtime JSON;
2. validate JSON key parity against English;
3. audit PO translation completeness and structure;
4. verify that generated runtime JSON matches the committed JSON dictionaries.

This makes the PO catalog the translation source of truth while keeping JSON as the React/i18next runtime format.
