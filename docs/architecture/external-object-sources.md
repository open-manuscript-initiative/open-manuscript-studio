# External object source attribution in Studio

## Application rule

An object created outside the current OMI manuscript needs a visible source
when it is inserted as scholarly material. This is an application import rule,
not a retroactive OMI-SPEC-320 schema change: opening a valid OMI manuscript
must not rewrite or reject existing blocks merely because older content lacks
source metadata. Objects authored directly in Studio, such as a blank table or
equation, do not need an external source.

## Current insertion paths

| Path | Source offered automatically | Required action | Current result |
| --- | --- | --- | --- |
| File → visual object (image, table, chart, equation, score) | File name and worksheet, chart or archive part when available | Review or edit a nonempty source for **each** object before insertion | A visible source paragraph immediately follows every inserted object; existing machine import provenance remains attached to the visual block. |
| Clipboard → visual object | Clipboard file name if supplied | Enter a source when absent, then confirm | Same object/source pairing. |
| Research module → saved excerpt | Module record's explicit source when available | Select one excerpt, review text and source, acknowledge and confirm | Visible source follows excerpt; currently implemented for four modules in Studio PR #631. |
| Studio-authored blank object | No external source | None | Existing authoring behavior. |
| OMI JSON/container open | Existing OMI identity, citations and history | Validate the OMI file | Preserve original content and its existing provenance; no synthetic source lines. |

File names are hints, not verified bibliographic citations. They may also contain
private information, so the researcher can correct them before they enter a
portable manuscript. This does not justify publishing confidential data. An
imported object without a source cannot pass the visual insertion command.

## Remaining paths and compatibility

Whole-document DOCX/PDF conversion, OJS/OMP manuscript intake, HTML/JATS,
reference-manager imports, and asset attachment have distinct source and
authority models. Inventory each path and capture source at the appropriate
document, record, asset or object level before enforcing a shared 1.0 gate.
Never impose a mandatory field directly on OMI-SPEC-320 without a specification
decision and explicit migration for stable files. OJS/OMP remain authoritative
for their submission and review workflow; their file metadata is a source hint,
not a reviewer identity disclosure.

The current visual pairing is visible text adjacent to the object plus existing
machine provenance. A semantic link between object and bibliographic record,
exporter fidelity for that link, and provenance verification remain follow-up
work. Release gates should cover every supported import path, missing source,
auto-fill quality, user correction, privacy, anonymized review, round-trip,
undo/revision, and rendering in HTML/PDF/JATS/DOCX.
