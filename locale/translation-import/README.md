# Returned translation import — 0.3.0-beta.1

This directory contains the translations returned from the Studio 0.3.0-beta.1
translation-master workbook.

- `0.3.0-beta.1-canonical.partNN.json.txt` chunks reconstruct the returned canonical `studio.json`/PO translations.
- `0.3.0-beta.1-supplemental.partNN.json.txt` chunks reconstruct returned coded-copy translations for account, storage, help, publication, references and native-client labels.

The chunks are ordinary UTF-8 text on purpose: this avoids the binary transport corruption that previously left the generated runtime overlay empty.

The payload contains translations for 35 target locales. Eleven target locales
were entirely blank in the returned workbook and therefore remain on the normal
English fallback until translations are supplied.

Runtime precedence is deliberately conservative: existing reviewed Studio
translations win. Returned DeepL values are used only where the current locale
still resolves to the English source string.

The returned workbook was also found to contain row-shifted translation columns.
Only locales that passed structural alignment checks are activated by the runtime
overlay. Suspect columns are explicitly quarantined rather than displaying a
translation belonging to a different source string. A corrected workbook can
promote those locales later without changing the overlay contract.

Direct component literals from the translation workbook are not treated as
runtime-complete merely because a translated string exists. Those literals must
first be migrated to stable i18n keys; the translation-master workbook remains
the migration source for that remaining debt.

Run `npm run i18n:returned:generate` to concatenate and validate the text-safe chunks and regenerate the runtime overlay JSON. The generator fails closed if a chunk set is missing or invalid; it must never silently publish an empty overlay.

## Alignment safety

The returned workbook contains row-shifted translation columns for some locales. Runtime import therefore activates only columns whose row alignment was verified against preserved technical/source strings. Currently verified: af, bg, cs, da, de, es, et, fi, fr, he, hu, id and lt. Shifted columns are retained as source material but are not applied until they are deterministically realigned.
