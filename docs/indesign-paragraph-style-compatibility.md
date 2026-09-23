# InDesign-compatible paragraph styles

Status: **implementation specification**  
Scope: Open Manuscript Studio publication paragraph styles, live publication rendering, IDML import/export, and loss-minimizing round trips.

This document maps the Adobe InDesign paragraph-style controls shown in the reference UI to Studio's target paragraph-style model. The goal is **behavioral and interchange compatibility**, not pixel-for-pixel reproduction of the InDesign dialog.

## Compatibility levels

| Mark | Meaning |
| --- | --- |
| **Native** | Studio can store, edit, preview and export the setting with equivalent semantics. |
| **Approx.** | Studio can store and export the setting, while browser/PDF preview is an approximation. |
| **Preserve** | Studio must retain the value for IDML round-trip even if the live renderer does not implement it. |
| **N/A** | The setting is metadata or UI-only and does not affect document rendering directly. |

## General rules

1. Paragraph-style inheritance uses `basedOnId`; inheritance cycles are rejected.
2. `nextStyleId` is preserved and used when Studio creates a following paragraph in style-aware editing.
3. Direct paragraph overrides remain separate from the style definition.
4. Unsupported IDML properties must not be silently discarded. Unknown-but-safe paragraph-style properties should be retained in an IDML compatibility extension bag until first-class Studio support is added.
5. Studio HTML/print preview must never be treated as proof that every IDML-only setting is rendered exactly. The style inspector should distinguish **previewed**, **approximated**, and **round-trip only** properties.
6. IDML import/export uses points for InDesign typography values and converts dimensional Studio values explicitly. Studio paragraph geometry continues to use millimetres where that is already the project convention.
7. Imported style names, `BasedOn`, `NextStyle`, list names, character-style references and GREP/nested-style references must remain stable across a round trip.

---

## 1. General

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Stílus neve | `definition.name` | N/A | Native | Native | Preserve Unicode name exactly. |
| Ez alapján | `definition.basedOnId` | Native | Native | Native | Cycle-safe inheritance. |
| Következő stílus | `definition.nextStyleId` | Native | Native | Native | Used for style-aware paragraph creation. |
| Gyorsbillentyű | `definition.shortcut` | N/A | Preserve | Native | Desktop-only activation may be added separately. |
| Stílusbeállítások összegzése | derived from resolved style | N/A | N/A | N/A | Read-only UI summary. |
| Stílus alkalmazása a kijelölésre | editor action | Native | N/A | N/A | Not a style property. |

## 2. Basic character formats

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Betűcsalád | `properties.fontFamily` | Native | Native | Native | Font availability is environment-dependent. |
| Betűstílus | `fontWeight` + `fontStyle` + optional face metadata | Native | Native | Native | Map named faces to CSS weight/style where possible. |
| Méret | `fontSize` | Native | Native | Native | pt. |
| Sortávolság | `lineHeight` | Native | Native | Native | Preserve Auto leading separately when imported. |
| Alávágás | `kerning` / `kerningMode` | Approx. | Preserve | Native | CSS cannot reproduce every InDesign kerning mode. |
| Betűköz | `tracking` | Native | Native | Native | InDesign tracking units map to CSS letter spacing. |
| Kis- és nagybetűk | `capitalization` | Native | Native | Native | normal, small caps, all caps; preserve additional IDML values. |
| Helyzet | `position` | Approx. | Preserve | Native | normal/superior/inferior/superscript/subscript as available. |
| Aláhúzott | `underline.enabled` | Native | Native | Native | Full underline details are in section 18. |
| Ligatúrák | `openType.ligatures` | Native | Native | Native | Via font-feature-settings where supported. |
| Nincs törés | `noBreak` | Native | Native | Native | Render with non-breaking behavior. |
| Áthúzás | `strikethrough.enabled` | Native | Native | Native | Full details are in section 19. |

## 3. Advanced character formats

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Vízszintes méretezés | `horizontalScale` | Approx. | Native | Native | CSS transform/font-stretch approximation. |
| Függőleges méretezés | `verticalScale` | Approx. | Native | Native | CSS transform approximation. |
| Alapvonal-eltolás | `baselineShift` | Native | Native | Native | pt. |
| Döntés | `skew` | Approx. | Native | Native | CSS skew approximation. |
| Nyelv | `language` | Native | Native | Native | Drives hyphenation and language metadata. |

## 4. Indents and spacing

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Igazítás | `alignment` | Native | Native | Native | left/center/right/justify and preserved extended variants. |
| Szabad sorvégek kiegyenlítése | `balanceRaggedLines` | Approx. | Preserve | Native | CSS text-wrap: balance can approximate some cases. |
| Optikai margó kihagyása | `ignoreOpticalMargin` | Preserve | Preserve | Native | Browser support is not equivalent to Adobe optical margin alignment. |
| Bal oldali behúzás | `leftIndent` | Native | Native | Native | mm internally. |
| Jobb oldali behúzás | `rightIndent` | Native | Native | Native | mm internally. |
| Első sor behúzása | `firstLineIndent` | Native | Native | Native | mm internally. |
| Utolsó sor behúzása | `lastLineIndent` | Approx. | Native | Native | Browser support depends on layout strategy. |
| Térköz előtte | `spaceBefore` | Native | Native | Native | pt. |
| Térköz utána | `spaceAfter` | Native | Native | Native | pt. |
| Azonos stílusú bekezdések között szóköz | `spaceBetweenSameStyle` | Native | Preserve | Native | Apply only between adjacent same-style paragraphs. |
| Rácshoz igazítás | `baselineGridAlignment` | Approx. | Preserve | Native | Studio can approximate with publication baseline grid. |

## 5. Tabs

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Bal tabulátor | `tabStops[].alignment = "left"` | Native | Native | Native | |
| Közép tabulátor | `tabStops[].alignment = "center"` | Native | Native | Native | |
| Jobb tabulátor | `tabStops[].alignment = "right"` | Native | Native | Native | |
| Tizedes / igazítás karakterhez | `tabStops[].alignment = "decimal"` + `decimalCharacter` | Approx. | Native | Native | Exact decimal alignment needs custom layout measurement. |
| X | `tabStops[].positionMm` | Native | Native | Native | |
| Sorkitöltés | `tabStops[].leader` | Native | Native | Native | |
| Igazítás be | `tabStops[].decimalCharacter` | Approx. | Native | Native | |
| Ismétlés | editor action | Native | N/A | N/A | Generates repeated stops. |
| Az összes törlése | editor action | Native | N/A | N/A | |

## 6. Paragraph rules

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Felső / alsó lénia | `ruleAbove` / `ruleBelow` | Native | Native | Native | |
| Lénia bekapcsolása | `rule*.enabled` | Native | Native | Native | |
| Vastagság | `rule*.widthPt` | Native | Native | Native | |
| Típus | `rule*.style` + optional IDML stroke name | Approx. | Preserve | Native | Preserve custom stroke styles. |
| Szín | `rule*.color` | Native | Native | Native | |
| Színárnyalat | `rule*.tint` | Native | Native | Native | |
| Körvonal felülnyomása | `rule*.overprint` | Preserve | Native | Native | Print-production property. |
| Köz színe / árnyalata | `rule*.gapColor`, `gapTint` | Approx. | Preserve | Native | Relevant to compound strokes. |
| Térköz felülnyomása | `rule*.gapOverprint` | Preserve | Native | Native | |
| Szélesség: oszlop / szöveg | `rule*.widthMode` | Native | Native | Native | column/text. |
| Eltolás | `rule*.offsetPt` | Native | Native | Native | |
| Bal / jobb oldali behúzás | `rule*.leftIndentMm`, `rightIndentMm` | Native | Native | Native | |
| Kereten belül marad | `rule*.keepInFrame` | Approx. | Preserve | Native | |

## 7. Paragraph border

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Szegély | `border.enabled` | Native | Native | Native | |
| Felső / alsó / bal / jobb vastagság | `border.widths.*Pt` | Native | Native | Native | Support linked/unlinked values. |
| Vastagságok összekapcsolása | UI state only | Native | N/A | N/A | |
| Típus | `border.style` + stroke name | Approx. | Preserve | Native | |
| Szín / árnyalat | `border.color`, `border.tint` | Native | Native | Native | |
| Köz színe / árnyalata | `border.gapColor`, `gapTint` | Approx. | Preserve | Native | |
| Felülnyomások | `border.overprint`, `gapOverprint` | Preserve | Native | Native | |
| Vonalvég | `border.cap` | Approx. | Preserve | Native | |
| Egyesítés | `border.join` | Approx. | Preserve | Native | |
| Sarokméretek | `border.corners.*.radiusMm` | Native | Native | Native | |
| Sarokalakok | `border.corners.*.shape` | Approx. | Preserve | Native | |
| Eltolások | `border.offsets.*Mm` | Native | Native | Native | |
| Felső / alsó szél referenciája | `border.topEdgeReference`, `bottomEdgeReference` | Approx. | Preserve | Native | |
| Szélesség | `border.widthMode` | Native | Native | Native | column/text. |
| Megjelenítés keret-/oszloptörésen át | `border.displayAcrossFrames` | Approx. | Preserve | Native | |
| Egymást követő azonos szegélyek egyesítése | `border.mergeConsecutive` | Native | Preserve | Native | |

## 8. Paragraph shading

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Árnyékolás | `shading.enabled` | Native | Native | Native | |
| Szín / árnyalat | `shading.color`, `shading.tint` | Native | Native | Native | |
| Felülnyomás | `shading.overprint` | Preserve | Native | Native | |
| Sarokméretek | `shading.corners.*.radiusMm` | Native | Native | Native | |
| Sarokalakok | `shading.corners.*.shape` | Approx. | Preserve | Native | |
| Eltolások | `shading.offsets.*Mm` | Native | Native | Native | |
| Felső / alsó szél referenciája | `shading.topEdgeReference`, `bottomEdgeReference` | Approx. | Preserve | Native | |
| Szélesség | `shading.widthMode` | Native | Native | Native | column/text. |
| Vágás a kerethez | `shading.clipToFrame` | Approx. | Preserve | Native | |
| Ne nyomtassa vagy exportálja | `shading.suppressInExport` | Native | Native | Native | |

## 9. Keep options

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Együtt az előzővel | `keepWithPrevious` | Native | Native | Native | |
| Együtt a következővel: N sor | `keepWithNextLines` | Approx. | Native | Native | Paged renderer must measure following lines. |
| Sorok együtt tartása: összes | `keepTogether` | Native | Native | Native | |
| Bekezdés elején N sor | `keepFirstLines` | Native | Native | Native | |
| Bekezdés végén N sor | `keepLastLines` | Native | Native | Native | |
| Bekezdés kezdete | `startParagraph` | Native | Native | Native | anywhere/next column/frame/page/odd/even. |

## 10. Hyphenation

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Elválasztás | `hyphenation` | Native | Native | Native | |
| Ha van benne legalább N betű | `hyphenationSettings.minimumWordLength` | Approx. | Native | Native | Studio language engine may not expose every knob. |
| Ha van előtte legalább N betű | `minimumPrefix` | Approx. | Native | Native | |
| Ha van utána legalább N betű | `minimumSuffix` | Approx. | Native | Native | |
| Legfeljebb N elválasztás | `maximumHyphens` | Approx. | Native | Native | |
| Elválasztási zóna | `hyphenationZoneMm` | Preserve | Native | Native | Primarily meaningful for non-justified text. |
| Jobb helykihasználás ↔ kevesebb elválasztás | `hyphenationSettings.preference` | Approx. | Preserve | Native | 0–100 normalized Studio value. |
| Nagybetűs szavak elválasztása | `hyphenateCapitalizedWords` | Approx. | Native | Native | |
| Utolsó szó elválasztása | `hyphenateLastWord` | Approx. | Native | Native | |
| Elválasztás oszlopon keresztül | `hyphenateAcrossColumns` | Approx. | Native | Native | |

## 11. Justification

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Szavak térköze min./kívánt/max. | `justification.wordSpacingMinimum/Desired/Maximum` | Approx. | Native | Native | |
| Betűtávolság min./kívánt/max. | `letterSpacingMinimum/Desired/Maximum` | Approx. | Native | Native | |
| Karakterméretezés min./kívánt/max. | `glyphScalingMinimum/Desired/Maximum` | Approx. | Native | Native | |
| Automatikus sortávolság | `justification.autoLeadingPercent` | Native | Native | Native | |
| Egyszavas sorkizárás | `singleWordAlignment` | Approx. | Native | Native | |
| Szerkesztő | `composer` | Preserve | Native | Native | Adobe Paragraph/Single-line Composer cannot be duplicated exactly in browsers. |

## 12. Span columns

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Bekezdésformátum | `spanColumns.mode` | Native | Native | Native | single/span/split. |
| Szakasz / hasáb száma | `spanColumns.count` | Native | Native | Native | |
| Belső / külső hasábköz | `insideGutterMm`, `outsideGutterMm` | Native | Native | Native | Expose when mode requires it. |

## 13. Drop caps and nested styles

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Iniciálé: sor | `dropCaps.lines` | Native | Native | Native | |
| Iniciálé: karakterek | `dropCaps.characters` | Native | Native | Native | |
| Karakterstílus | `dropCaps.characterStyleId` | Native | Native | Native | |
| Bal oldali szegély igazítása | `dropCaps.alignLeftEdge` | Approx. | Preserve | Native | |
| Igazítás az alsó nyúlványokhoz | `dropCaps.scaleForDescenders` | Approx. | Preserve | Native | |
| Egymásba ágyazott stílusok | `nestedStyles[]` | Approx. | Native | Native | Studio can execute common delimiters; preserve all IDML rules. |
| Egymásba ágyazott vonalstílusok | `nestedLineStyles[]` | Approx. | Native | Native | |

## 14. GREP styles

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| GREP szabály | `grepStyles[].expression` | Approx. | Native | Native | Preserve Adobe-compatible expression text verbatim. |
| Karakterstílus | `grepStyles[].characterStyleId` | Approx. | Native | Native | |
| Szabály sorrendje | array order | Native | Native | Native | Order is significant. |

Studio preview must execute GREP styles only through a constrained, non-catastrophic regular-expression path. Unsupported Adobe regex constructs are preserved but not executed.

## 15. Bullets and numbering

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Lista típusa | `bulletsAndNumbering.type` | Native | Native | Native | none/bullets/numbers. |
| Lista | `listName` | Native | Native | Native | Named lists survive round trip. |
| Szint | `level` | Native | Native | Native | |
| Felsorolásjel | `bulletCharacter` / custom bullet set | Native | Native | Native | |
| Szöveg utána | `format` / `numberExpression` | Native | Native | Native | Preserve InDesign tokens. |
| Karakterstílus | `characterStyleId` | Native | Native | Native | |
| Igazítás | `alignment` | Native | Native | Native | |
| Bal oldali behúzás | `leftIndentMm` | Native | Native | Native | |
| Első sor behúzása | `firstLineIndentMm` | Native | Native | Native | |
| Tabulátor helye | `tabPositionMm` | Native | Native | Native | |
| Kezdőérték / újraindítás | `startAt`, `restartAfterLevel` | Native | Native | Native | Visible for numbered lists. |

## 16. Character color

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Kitöltés színe | `fillColor` | Native | Native | Native | Preserve swatch reference plus fallback color. |
| Színárnyalat | `fillTint` | Native | Native | Native | |
| Felülnyomott kitöltés | `fillOverprint` | Preserve | Native | Native | |
| Körvonal színe | `characterStroke.color` | Approx. | Native | Native | CSS text-stroke where available. |
| Vastagság | `characterStroke.widthPt` | Approx. | Native | Native | |
| Körvonal árnyalata | `characterStroke.tint` | Approx. | Native | Native | |
| Felülnyomott körvonal | `characterStroke.overprint` | Preserve | Native | Native | |
| Ferde vágás határa | `characterStroke.miterLimit` | Preserve | Native | Native | |
| Körvonal igazítása | `characterStroke.alignment` | Preserve | Native | Native | Browser text stroke has no equivalent alignment control. |

## 17. OpenType features

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Címváltozatok | `openType.titlingAlternates` | Native when font supports | Native | Native | |
| Hajlításváltozatok | `openType.swash` | Native when font supports | Native | Native | |
| Környezetfüggő változatok | `contextualAlternates` | Native | Native | Native | |
| Sorszámok | `ordinals` | Native | Native | Native | |
| Tetszés szerinti ligatúrák | `discretionaryLigatures` | Native | Native | Native | |
| Törtek | `fractions` | Native | Native | Native | |
| Perjeles nulla | `slashedZero` | Native | Native | Native | |
| Számstílus | `openType.figureStyle` | Native when font supports | Native | Native | lining/oldstyle + proportional/tabular. |
| Helyfüggő alak | `openType.positionalForm` | Native when font supports | Native | Native | |
| Stíluskészletek | `openType.stylisticSets[]` | Native when font supports | Native | Native | Preserve all selected sets. |

## 18. Underline options

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Aláhúzás bekapcsolva | `underline.enabled` | Native | Native | Native | |
| Vastagság | `underline.weightPt` | Native | Native | Native | |
| Eltolás | `underline.offsetPt` | Native | Native | Native | |
| Típus | `underline.style` + stroke name | Approx. | Preserve | Native | |
| Szín / árnyalat | `underline.color`, `tint` | Native | Native | Native | |
| Körvonal felülnyomása | `underline.overprint` | Preserve | Native | Native | |
| Köz színe / árnyalata | `underline.gapColor`, `gapTint` | Approx. | Preserve | Native | |
| Térköz felülnyomása | `underline.gapOverprint` | Preserve | Native | Native | |

## 19. Strikethrough options

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| Áthúzás bekapcsolva | `strikethrough.enabled` | Native | Native | Native | |
| Vastagság | `strikethrough.weightPt` | Native | Native | Native | |
| Eltolás | `strikethrough.offsetPt` | Native | Native | Native | |
| Típus | `strikethrough.style` + stroke name | Approx. | Preserve | Native | |
| Szín / árnyalat | `strikethrough.color`, `tint` | Native | Native | Native | |
| Körvonal felülnyomása | `strikethrough.overprint` | Preserve | Native | Native | |
| Köz színe / árnyalata | `strikethrough.gapColor`, `gapTint` | Approx. | Preserve | Native | |
| Térköz felülnyomása | `strikethrough.gapOverprint` | Preserve | Native | Native | |

## 20. Export tagging

| InDesign control (HU) | Studio target | Live rendering | IDML import | IDML export | Notes |
| --- | --- | --- | --- | --- | --- |
| EPUB és HTML címke | `exportTagging.htmlTag`, `epubTag` | Native | Native | Native | Auto resolves from manuscript semantics when unset. |
| ARIA szerep | `exportTagging.ariaRole` | Native | Native | Native | Must be validated against allowed ARIA roles. |
| HTML-osztályok alkalmazása | `exportTagging.applyHtmlClass` | Native | Native | Native | |
| Osztály | `exportTagging.cssClass` | Native | Native | Native | Sanitize as CSS identifier(s). |
| CSS készítése | `exportTagging.emitCss` | Native | Native | Native | |
| Exportadatok | derived preview | N/A | N/A | N/A | Generated read-only summary. |
| Dokumentum darabolása | `exportTagging.splitDocument` | Native | Native | Native | EPUB packaging. |
| PDF címke | `exportTagging.pdfTag` | Native | Native | Native | Tagged PDF structure role. |

---

## Studio model additions required beyond the current implementation

The first compatibility-model pass already covers the principal groups, but the complete target requires these additions before the model is considered field-complete:

- `kerningMode`, `position`, `noBreak`;
- `balanceRaggedLines`, `ignoreOpticalMargin`, `spaceBetweenSameStyle`, `baselineGridAlignment`;
- compound-stroke gap color/tint/overprint and named stroke styles;
- independent paragraph-border side widths, corner shapes, cap/join, edge references and merge behavior;
- shading corner shapes, edge references, overprint, clipping and export suppression;
- `keepWithPrevious`, `keepWithNextLines`;
- hyphenation preference slider;
- `autoLeadingPercent` and `composer`;
- drop-cap edge/descender alignment and nested line styles;
- character fill overprint and character stroke;
- additional OpenType controls (titling, swash, figure style, positional form, multiple stylistic sets);
- underline/strikethrough compound-stroke fields;
- ARIA role, PDF tag, HTML-class toggle and CSS-generation toggle.

These fields should be added as typed properties rather than a generic dictionary. A generic extension bag is reserved only for safe, unknown IDML attributes that Studio does not yet understand.

## IDML import architecture

The importer should return **all paragraph style definitions**, not only a small semantic subset. The target imported record is:

```ts
interface ImportedIdmlParagraphStyle {
  sourceId: string;
  name: string;
  basedOnSourceId: string | null;
  nextStyleSourceId: string | null;
  shortcut?: string;
  properties: PublicationParagraphStyleProperties;
  preservedIdml?: Record<string, string | number | boolean>;
}
```

Import then performs two separate operations:

1. **Preserve the complete style graph** as Studio paragraph styles.
2. **Optionally map selected styles to semantic publication roles** such as body, heading 1, footnote and bibliography.

Semantic mapping must never be used as a reason to discard unmapped InDesign styles.

## IDML export architecture

`buildIdmlExport()` must stop generating only fixed `OMI Body`, `OMI Heading 1`, etc. style definitions. It should accept the active `PublicationStyle` and:

1. serialize every Studio paragraph style into `Resources/Styles.xml`;
2. write `BasedOn` and `NextStyle` references from the Studio style graph;
3. emit paragraph-style attributes/properties for every supported field;
4. restore preserved safe IDML attributes for properties that Studio retained but did not interpret;
5. apply manuscript `paragraphStyleId` values to the corresponding `ParagraphStyleRange`;
6. keep semantic fallback styles only for content that has no explicit paragraph-style assignment.

## HTML and print rendering policy

The Studio renderer has three obligations:

- **Native** settings must visibly affect the HTML5 and print views.
- **Approx.** settings must use the closest stable browser/Paged Media behavior and be marked as approximated in the style inspector.
- **Preserve** settings must remain editable/storable and round-trip through IDML without falsely implying that Studio previews them exactly.

Print-specific output properties such as overprint are not meaningful in ordinary browser preview; they belong to the export/production layer.

## Round-trip acceptance tests

A paragraph-style compatibility fixture must exercise at least:

- based-on and next-style chains;
- font/size/leading/tracking/scale/baseline/language;
- indents and paragraph spacing;
- four tab alignments and leaders;
- rule above and rule below;
- independent borders and shading;
- keep/start paragraph settings;
- full hyphenation and justification ranges;
- span/split columns;
- drop cap, nested style, nested line style and GREP style;
- bullet and multilevel number lists;
- fill/stroke color properties;
- OpenType features and stylistic sets;
- underline and strikethrough;
- EPUB/HTML/ARIA/PDF export tagging.

For supported fields:

`IDML A -> Studio -> IDML B -> Studio`

must preserve the normalized Studio value. For **Preserve** fields, the exported IDML representation must retain the imported semantic value even where the Studio preview cannot render it exactly.

## Implementation sequence

1. Complete the typed paragraph-style model and normalization.
2. Build the category-based paragraph-style editor UI.
3. Apply Native/Approx. properties to HTML5 and print rendering.
4. Replace semantic-only IDML style import with full style-graph import.
5. Replace fixed-style IDML export with active Studio style serialization.
6. Add round-trip fixtures and conformance tests.
7. Mark paragraph-style IDML compatibility as Stable only after the conformance matrix has no mandatory-field loss.
