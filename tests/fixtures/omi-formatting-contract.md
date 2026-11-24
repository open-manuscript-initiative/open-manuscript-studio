# Master DOCX formatting regression contract

The original 65-case fixture and manifest remain unchanged. Eight existing character-mark cases are asserted in `docx-manuscript-fidelity.test.ts`. The remaining 57 cases now have executable assertions in `docx-master-formatting-contract.ts`, registered by the same existing test file and therefore included in `npm test`.

For each of the 57 cases the suite checks:

1. The source DOCX's actual WordprocessingML property, relationship, object, note, review marker or text sequence. Labels alone cannot satisfy these checks.
2. Model retention after the production DOCX importer, continuous-editor projection, and serialized OMI reopening. For unsupported presentation attributes this checks retained sample text, not an unsupported exact visual representation; for supported language, note, table, image and math objects it also checks their actual model properties.
3. Native DOCX publication output after reopening, including exact typography or relationships. Review comments and tracked edits have separate internal-model retention assertions and public-export privacy assertions instead of requiring private review history in a publication export.

The source checks and supported model/export checks are blocking. Known fidelity gaps execute real assertions with a named Node test TODO result by default; they do not count as passing compatibility checks. No empty TODO placeholders remain. The strict mode makes all gaps blocking:

```sh
OMI_FORMATTING_STRICT=1 node --test --experimental-strip-types --import ./tests/register-ts-extension-loader.mjs tests/docx-manuscript-fidelity.test.ts
```

PowerShell:

```powershell
$env:OMI_FORMATTING_STRICT = "1"
node --test --experimental-strip-types --import ./tests/register-ts-extension-loader.mjs tests/docx-manuscript-fidelity.test.ts
Remove-Item Env:OMI_FORMATTING_STRICT
```

The existing Playwright import-opening suite also exercises changing and removing the six language marks from the imported fixture, in addition to the previous underline scenario.

```sh
npx playwright test e2e/import-opening.spec.ts --project=desktop-chromium
```

## Scope and current limitations

- The fixture's List Bullet 2 / List Number 2 are separately indented level-zero list definitions, not genuine nested levels. The native assertions check numbering kind, indentation and the continued L03/L05 numbering sequence.
- Character and paragraph typography, custom styles, native numbering, RTL direction, note color, native visual object export, bookmarks, fields, hyperlinks and Word section/header metadata have explicit round-trip acceptance assertions, even if the current implementation cannot satisfy them.
- This change does not implement missing editor controls. Interactive edit/reset coverage is not yet complete for all cases; the language-mark scenarios use actual toolbar actions, not simulated JSON edits.
- HTML, ODT, PDF and other export fidelity are outside this native DOCX contract and need format-specific assertions rather than assuming a Word property is representable in every format.
- Remove a known-gap reason only after the corresponding exact assertion is shown to pass. Do not remove or weaken the assertion to make CI green.
