# Open Manuscript Studio localization

Open Manuscript Studio uses a PO-first translation workflow with generated JSON runtime dictionaries.

## Architecture

The canonical translator-facing files are gettext PO files:

```text
locale/
  en/studio.po
  hu/studio.po
  de/studio.po
  bg/studio.po
  ...
```

The web application consumes generated JSON dictionaries:

```text
src/i18n/locales/<locale>/studio.json
```

This keeps the React/i18next runtime simple while allowing translators to use gettext-compatible tools such as Weblate, Poedit and other PO editors.

## Platform language parity

The shared Studio frontend is used by the web, Windows, Linux, macOS, Android
and iOS/iPadOS builds, so interface-language availability is defined once in
`src/i18n/platformLocales.ts`.

The platform registry covers the 49 Google Play locale entries. Regional store
variants that intentionally share one UI dictionary are canonicalized:

- `en-US`, `en-GB` → `en`;
- `es-ES`, `es-419` → `es`;
- `fr-CA`, `fr-FR` → `fr`;
- `pt-BR`, `pt-PT` → `pt`.

Chinese variants remain separate UI locales because script/region differences
are user-visible: `zh-CN`, `zh-TW`, and `zh-HK`.

Irish (`ga`) and Maltese (`mt`) remain available from the earlier EU
localization set, so the shared UI registry exposes 47 selectable locale
choices while covering all 49 Google Play locale entries.

All 47 canonical Studio UI locales have PO catalogues. Existing translator
work remains authoritative. Google Play translation sync is used only to
backfill source strings that still resolve to English, including gaps in the
older partially translated catalogues.

Irish (`ga`) already has a reviewed completion overlay. Maltese (`mt`), which
is not one of the configured Google Play translation targets, is completed
through reviewed manual completion overlays.

## Google Play translation bridge

The Studio UI is React-based, so its canonical strings are not normally Android
`strings.xml` resources. Google Play automatic **App strings** translation
therefore cannot see the complete Studio interface by default.

For Play AAB builds, `scripts/generate-play-translation-resources.mjs`
temporarily mirrors every unique English Studio source string into generated,
translatable Android resources. These bridge resources are included only in the
Play bundle and are removed immediately after the build; the direct APK is not
changed.

After Google Play has processed the uploaded AAB and generated App strings
translations, run **Google Play Translation Sync** with that Android
`versionCode`. The workflow:

1. downloads the Play-generated universal APK through the Google Play Developer
   API;
2. reads the localized bridge resources with `aapt2`;
3. maps Play region variants to the canonical Studio locale;
4. preserves every existing non-English PO translation and reviewed overlay;
5. writes only missing English-identical values to
   `locale/completion-overlays/<locale>.play.json`;
6. recompiles the runtime JSON dictionaries and runs the completeness audit;
7. opens a reviewable translation pull request.

This means Play-generated translations can complete both newly added languages
and gaps in older catalogues without overwriting prior human translation work.

## PO mapping

Every translatable string has three relevant fields:

```po
#. OMI translation key: /studio/navigation/document
msgctxt "/studio/navigation/document"
msgid "Document"
msgstr "Dokumentum"
```

- `msgctxt` is the stable OMI translation path encoded as a JSON Pointer.
- `msgid` is the current English source string.
- `msgstr` is the translation for the locale.

`msgctxt`, not the English wording, is the stable identity of a translation. This means English copy can evolve without changing the semantic translation key.

Arrays, including Help topics and tips, use indexed JSON Pointer paths such as:

```text
/modules/help/topics/0/title
/modules/help/topics/0/tips/1
```

## Initial export from JSON

During migration, generate PO files from the existing validated JSON dictionaries:

```bash
npm run i18n:po:export
```

The exporter requires every locale to have exactly the same translation paths as English.

## Compile PO to runtime JSON

After translators edit the PO files, regenerate runtime dictionaries with:

```bash
npm run i18n:po:compile
```

The compiler rejects a locale when:

- a translation key is missing;
- an unknown key is present;
- a `msgctxt` is duplicated;
- a `msgid` is stale and no longer matches the current English source;
- a `msgstr` is empty.

The generated dictionaries should then be validated and built:

```bash
npm run i18n:validate-json
npm run build
```

For migration and round-trip testing:

```bash
npm run i18n:po:roundtrip
```

## Source-of-truth policy

After the PO migration is accepted, translators should edit `locale/<locale>/studio.po`, not the generated `src/i18n/locales/<locale>/studio.json` files.

English remains the reference locale. Adding or changing a user-interface string therefore follows this sequence:

1. add or update the English translation path;
2. update/export PO source entries;
3. translate `msgstr` values in each supported locale;
4. compile PO to JSON;
5. validate locale parity;
6. run tests and the production build.

## Translation principles

OMI identifiers, file extensions and standards such as OMI, ORCID, ROR, DOI, JATS, CSL, DOCX, JSON, XML, HTML, SHA-256 and BCP 47 should normally remain unchanged. User-facing scholarly terminology should be translated consistently within each language.

The PO layer is an interchange and translation-maintenance format. It does not change the OMI manuscript format and is not embedded in `.omi` manuscript packages.
