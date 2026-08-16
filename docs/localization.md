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
