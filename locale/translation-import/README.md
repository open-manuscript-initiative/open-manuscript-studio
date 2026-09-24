# Returned translation import — 0.3.0-beta.1

This directory contains the translations returned from the Studio 0.3.0-beta.1
translation-master workbook.

- `0.3.0-beta.1-canonical.json.gz` contains translations for canonical
  `studio.json`/PO keys.
- `0.3.0-beta.1-supplemental.json.gz` contains translations for coded-copy
  surfaces such as account, storage, help, publication, references and native
  client labels.

The payload contains translations for 35 target locales. Eleven target locales
were entirely blank in the returned workbook and therefore remain on the normal
English fallback until translations are supplied.

Runtime precedence is deliberately conservative: existing reviewed Studio
translations win. Returned DeepL values are used only where the current locale
still resolves to the English source string.

Direct component literals from the translation workbook are not treated as
runtime-complete merely because a translated string exists. Those literals must
first be migrated to stable i18n keys; the translation-master workbook remains
the migration source for that remaining debt.

Run `npm run i18n:returned:generate` to regenerate the runtime overlay JSON.
