# OMI Studio translation audit

The canonical translator-facing catalogs are `locale/<locale>/studio.po`.

For systematic completion of an existing locale, Studio may also contain a reviewed delta in `locale/completion-overlays/<locale>.json`. An overlay is deliberately narrow: it is considered only when the corresponding PO `msgstr` is still identical to the English `msgid`. An already localized PO value always wins. This allows large translation-completion reviews to be kept as explicit, auditable deltas without overwriting existing translator work.

Run the summary audit with:

```bash
npm run i18n:po:audit
```

To list every effective translation key that is still identical to English and has not been explicitly reviewed in an overlay, run:

```bash
npm run i18n:po:audit:details
```

The audit reports, per locale:

- total expected PO entries;
- effectively translated entries;
- completion percentage;
- reviewed completion-overlay values;
- empty `msgstr` values;
- remaining values identical to English and therefore requiring review;
- missing, extra, stale or duplicate translation keys;
- whether the locale is declared complete.

## Completion policy

`locale/translation-status.json` controls release completeness.

A locale not listed in `completeLocales` may contain unreviewed English-identical candidates while translation is still in progress. Structural errors and empty translations are always rejected.

Once a locale has been reviewed and completed, add its locale code to `completeLocales`. From that point the CI audit rejects every English-identical entry that is neither explicitly reviewed in a completion overlay nor listed in the locale allowlist.

An overlay entry is a reviewed translation decision, not a wildcard exemption. `byPointer` is preferred where the same English source requires different translations in different contexts; `bySource` may be used when the same reviewed translation is valid everywhere that source text occurs. Product names, standards, identifiers and other intentionally untranslated terms may therefore remain textually identical to English only when the decision is explicit.

The older `identicalAllowlist` mechanism remains supported for established completed locales, but it must not be used to hide untranslated interface prose.

## CI gate

CI performs the following localization checks before the application build:

1. compile PO catalogs plus reviewed completion overlays to runtime JSON;
2. validate JSON key parity against English;
3. audit effective translation completeness and PO structure;
4. verify that any generated runtime JSON difference is backed by a reviewed completion overlay;
5. run the application test suite and build.

This keeps PO catalogs as the translator-facing baseline, makes reviewed completion work explicit and auditable, and keeps JSON as the React/i18next runtime format. Completion overlays can later be folded back into PO catalogs without changing runtime semantics.
