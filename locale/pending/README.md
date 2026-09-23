# Translation queues

The existing JSON files in this directory are the 722-entry PO queues. The
additional source-level queue is in `supplemental/` and covers text that still
lives in component-local dictionaries or direct UI literals.

Each `supplemental/<locale>.json` file contains:

- `key`, `source`, `kind`, `surface` and `sourceFile` — source metadata; leave these unchanged;
- `translation` — the only field to translate;
- `translationSource` — present when a previously supplied module translation
  was found and carried forward instead of being requested again;
- `protectedTerms` — terms, placeholders and URLs that must remain intact;
- `deepL` — the DeepL name and target code for the locale.

The queues are generated with:

```sh
npm run i18n:pending:supplemental
```

The language map uses DeepL’s English language names. For example, the Studio
`pt` locale is `Portuguese (European)` with target code `PT-PT`, and `no` is
`Norwegian (Bokmål)` with target code `NB`. Chinese regional Studio locales
share DeepL’s `Chinese` target. A locale with `deepL.supported: false` has no
corresponding DeepL target in the checked language map and must not be assigned
an invented DeepL code.

`pendingCount` counts only blank `translation` fields; `entryCount` also
includes carried-forward values from `scripts/i18n-module-translations/`.

The supplemental queue is an inventory/input file, not a runtime dictionary.
After the blank values are translated and the carried-forward values reviewed,
they still need to be wired into the corresponding shared i18n surface. This
separation prevents source-level copy from being mistaken for the canonical PO
catalogue.
