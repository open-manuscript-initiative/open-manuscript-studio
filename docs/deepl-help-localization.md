# DeepL API workflow for Studio detailed help

The Studio detailed help has hand-maintained Hungarian, English and German source text. Other supported interface locales can be generated from the English detailed help with the DeepL API and then reviewed manually.

## Security

Never commit a DeepL API key to the repository, `.env` files, source code, screenshots or CI logs. The translation script reads the key only from the `DEEPL_API_KEY` environment variable.

The script chooses the DeepL API endpoint automatically: keys ending in `:fx` use the Free endpoint and other keys use the Pro endpoint. `DEEPL_API_URL` can override the endpoint when necessary.

## 1. Check what is missing

No API key is required for the dry run:

```powershell
npm run i18n:deepl:help:check
```

The command lists selected locales, already generated locales and locales that still need detailed-help translations. It does not send text to DeepL and does not modify files.

To inspect only selected locales:

```powershell
npm run i18n:deepl:help:check -- --locales=fr,es,it
```

## 2. Set the API key

PowerShell for the current terminal session:

```powershell
$env:DEEPL_API_KEY = "YOUR_DEEPL_API_KEY"
```

Bash/zsh:

```bash
export DEEPL_API_KEY="YOUR_DEEPL_API_KEY"
```

Do not put the real value into repository files.

## 3. Generate missing translations

```powershell
npm run i18n:deepl:help
```

The script asks DeepL which target languages the current account supports. A Studio locale that is not available in DeepL is reported and skipped instead of aborting the whole job.

To translate only selected locales:

```powershell
npm run i18n:deepl:help -- --locales=fr,es,it
```

Existing generated locale blocks are preserved. To deliberately regenerate them:

```powershell
npm run i18n:deepl:help -- --locales=fr --force
```

## 4. Review and validate

Generated content is written to:

```text
src/i18n/helpDetailed.generated.ts
```

The generated file is committed to Git so every browser, desktop and mobile build receives exactly the reviewed translations without needing a DeepL key at runtime.

Review terminology and natural language before committing, especially publisher, peer-review and scholarly-publishing terminology. After review run:

```powershell
npm run build
npm test
```

## Protected terminology

The translator wraps important technical names in ignored XML tags so DeepL keeps them unchanged. The protected list currently includes Open Manuscript Studio, Open Manuscript Initiative, OMI, OJS, OMP, ORCID, ROR, DOI, DOCX, IDML, JATS, CSL, CSS, HTML, PDF, EPUB, WebAuthn, SHA-256, passkey, LaTeX and related interchange-format names.

## Runtime behavior

`helpDetailedAll.ts` first looks for a reviewed/generated translation for the current locale. If none exists, it falls back to the existing built-in detailed-help resolver. Hungarian, English and German therefore remain the authoritative hand-maintained versions, while generated locales can be added incrementally.
