# Family trees and relationship networks

Two optional research modules share one project for the signed-in user and
workspace:

- `org.omi.genealogy`: people, parent–child relationships and partners, displayed
  in generations.
- `org.omi.relationship-networks`: the same people plus institutions, places,
  events, kinship, godparenthood, patronage, correspondence, teaching, membership,
  employment and custom relationships.

Enable either or both under Settings → Research modules. Both IDs are part of
the default server installation policy and the server preference validator.
Installations maintaining an explicit `STUDIO_ENABLED_MODULES` override must
include the IDs they wish to offer; the user cannot bypass that policy.

## Editing and diagrams

Add records, select one in the searchable list or diagram, edit its fields and
press Save. Names, alternative names, literal birth/death dates, places, notes
and source references remain editable after import. Relations have their own
sources, notes, start/end dates, direction and assertion status. Parentage can
be unspecified, biological, adoptive, foster or another recorded type.

Recorded/not challenged is not a claim that the information has been independently
verified. Dates are text: circa, before/after, ranges and calendar annotations
are not converted into invented exact dates. Missing records do not create
imaginary relatives. Parent cycles and self-links are rejected; repeated ancestors
in different branches (pedigree collapse) are supported.

Drag diagram nodes, pan the background, zoom, reset layout or focus on a selected
record to a chosen connection depth. Each view retains separate node positions.
The diagram shows at most 200 records; the searchable project and JSON backup
retain all data (up to 10,000 nodes and 30,000 relationships).

SVG exports contain only the currently displayed diagram. CSV exports contain
all relationships, record IDs, labels, dates, notes and source references.
“Insert diagram into manuscript” inserts an SVG image snapshot in the selected
section, leaving the editable research project separate.

## GEDCOM import

Export a `.ged` file from the external genealogy program, preferably as UTF-8.
The importer reads core records from GEDCOM 5.5, 5.5.1 and 7:

- People and structured/alternative names, recorded sex, the first birth/death
  event's date and place, notes (including shared notes and line continuations),
  and source titles/authors/publication details with citation page locators.
- Families, partners, child links and reciprocal individual family pointers;
  marriage/divorce dates, marriage places, family sources and notes.
- Child-family pedigree types, challenged/disproven status, individual adoption
  events selecting one family partner, and individual associations.

Unicode UTF-8 and UTF-16 BOMs are detected. The encoding selector also supports
UTF-16 LE/BE and Windows-1250/1252. ANSI without a known code page is not guessed;
ANSEL is deliberately rejected with instructions to export Unicode from the
source program. GEDCOM input is limited to 8 MiB and 250,000 lines.

Import first shows a preview. Adding remaps internal IDs and never silently
conflates matching names or source-program identifiers. Replacing requires an
explicit confirmation when existing data is present. Undo can restore the
previous project after either operation or after deletion.

This is a core-data importer, not a complete GEDCOM editor or GEDZIP reader.
Photographs, multimedia payloads, all event variants, repositories and custom
program extensions are not modeled as editable fields. The preview discloses
that limitation, and the original decoded source plus original file bytes are
retained in JSON backups. The original file can be downloaded byte-for-byte.
Editing graph records does not rewrite the retained original import. GEDCOM
export is not provided; use editable project JSON for Studio round trips.

Format reference: [FamilySearch GEDCOM specifications](https://gedcom.io/specs/),
including [the version 7 specification](https://gedcom.io/specifications/FamilySearchGEDCOMv7.html).

## Storage and portability

Projects are stored in IndexedDB on the current device, keyed by user ID and
workspace ID. Both mounted module views use one observable store and serialized
transactional writes, so one view cannot overwrite the other's current edits.
Controls remain disabled until the initial read completes. Failed writes leave
in-memory work intact and show a backup warning. A bounded local undo history
is available during the session.

The research dataset is not a shared server database, is not synchronized across
devices or browser tabs, and is not automatically included in an OMI manuscript.
Use Export editable JSON for a full backup/transfer, then import it on the other
device. An OMI file containing the inserted SVG retains the diagram image, not
the graph editor dataset. Exports use the shared native save mechanism in Tauri
applications and safe browser downloads on the web.

The workspace editor has English, Hungarian and German copy. Catalog names are
also localized in the other primary Studio languages, with English fallback.
No private manuscripts or genealogy files are included in the test fixtures.

## Reviewed manuscript contribution

**Insert diagram into manuscript** first shows the exact SVG snapshot and an
editable source suggestion. Sources are suggested from displayed records/relations,
falling back to imported file names; these labels are not independently verified.
Confirm the source or explicitly declare own research data, then approve that exact
snapshot. Changing the source/declaration resets approval. Changes to the project,
view, active manuscript or section require a new preview.

External data inserts the diagram, adjacent source paragraph, provisional
bibliographic record and `author-confirmed` derivation relation as one reversible
manuscript change. The OMI save/history retains these objects; HTML/JATS retain the
visible source and warn where structured derivation is not supported. An own-work
declaration hides the visible source while carrying the author's declaration and
supplied source internally in a semantic annotation. It grants no peer-review or
verification status. It does not claim the diagram was authored outside OMI.

The full graph, original GEDCOM and private research notes remain in workspace
storage/backup, separate from the reviewed manuscript snapshot. Insertion does not
create ongoing synchronization, overwrite later manuscript edits or restrict author
editing. See [ADR-035](architecture/adr-035-text-box-profile-and-research-diagram-provenance.md).
