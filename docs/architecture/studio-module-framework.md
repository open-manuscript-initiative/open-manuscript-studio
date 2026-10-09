# Studio discipline module framework

## Scope

A Studio module adds an optional research workflow for one or more disciplines.
The module system is separate from OMI manuscript semantics: modules may use
Studio services and external providers, but must not change the OMI document
model merely to store module-specific state.

The framework provides provider-neutral manifests, a validated in-process
registry, contribution slots, capability declarations, and two-level activation.
The Studio menu opens a module manager and hosts the built-in discipline
modules. The current catalog covers history and archives, religious texts,
critical text edition, corpus linguistics, musicology, cultural heritage, social
research methods, legal sources, and research reproducibility. Their specific
workflows are described in the catalog below. Most discipline workspaces persist
in browser storage and provide JSON export; the server stores module activation
preferences separately by user and workspace. The Musicology parser accepts
uncompressed MusicXML, ignores external DTD identifiers, rejects entity
declarations, and does not render notation. Modules do not load remote code.

## Built-in module catalog

The initial catalog includes these modules:

| Module | Disciplines | Current scope |
| --- | --- | --- |
| History and archives | History, archival studies | Search Europeana's shared cultural heritage catalogue and NARA's federal archival descriptions, and open the eLevéltár portal for Hungarian archival descriptions from the Hungarian National Archives and Budapest City Archives. |
| Religious texts | Theology, religious studies | Search Sefaria's Jewish text and commentary library live, display short excerpts with citation and edition metadata, and link to Bible, Qur'an, and Buddhist text portals. The first embedded full-text connector covers Sefaria only. |
| Critical text edition | Philology, classical philology, literary studies | Manage transcriptions, textual variants, manuscript witnesses, critical apparatus, and digital editions. |
| Corpus linguistics | Linguistics | Search corpora, produce concordances, align texts, and annotate linguistic features. |
| Musicology | Musicology | Import uncompressed MusicXML, catalog musical events, and link score events to recording timestamps. |
| Cultural heritage | Archaeology, art history, museum studies | Describe objects and sites with provenance metadata, link images, and annotate image regions. |
| Social research methods | Social sciences, behavioral sciences, economics | Record research design and ethics notes, maintain a variable codebook, and code selected transcript passages. |
| Legal sources | Law | Record jurisdiction, citations, dates, status, source links, and dated text versions; compare two saved versions side by side. Search EUR-Lex directly and open portal-scoped web searches for InfoCuria, the UN Treaty Collection, Roman law, and Vatican canon-law sources. External results are not imported. |
| Research reproducibility | Natural sciences, engineering | Link publications to versioned datasets, code, methods, software, supplements, repositories, persistent identifiers, licenses, and checksums. |
| Spatial research and GIS | Geography, GIS, spatial humanities | Register georeferenced objects, edit point coordinates, and import/export GeoJSON FeatureCollections while retaining declared coordinate reference information. No reprojection or map tile service is provided. |
| Archaeology | Archaeology, archaeometry, material culture | Document sites, stratigraphic contexts, dating, finds, sample identifiers, coordinates, and source records; import and export project JSON. |
| Experimental and laboratory research | Physics, chemistry, biology, materials science | Organize investigations and studies with samples/materials, protocols, instruments/calibration, assays, measurements with units/uncertainty, and raw or derived artifacts. Discipline profiles capture additional context. |

Experimental and Laboratory Research uses an OMI module JSON schema with a versioned Investigation → Study → Assay structure. It supports physics, chemistry, biology, and materials-science profiles; sample/material registers; protocol steps; instrument and calibration records; measurements with unit, uncertainty, time, and instrument links; raw/derived/code artifacts; and local SHA-256 calculation. It does not upload selected local files or claim to serialize official ISA-Tab. Project records are stored in browser storage and can be imported/exported as module JSON.

Spatial Research and Archaeology save project records in browser storage with portable exports. GeoJSON import preserves supported Point, LineString, Polygon, and Multi* geometry coordinates; the coordinate reference system is recorded as project metadata and is not transformed. Archaeology records group contexts and finds under one site/project and do not replace a formal excavation database.

The History and Archives entry has on-demand Europeana Search API and U.S.
National Archives Catalog searches, plus a direct link to the official
eLevéltár archival search portal for Hungarian holdings. Europeana results link
to their Europeana record and, where available, the source institution; NARA
results link to the original catalog record. eLevéltár search opens in the
provider's portal because no supported public API endpoint has been confirmed.
These sources do not cover every archive or replace a provider's catalogue.

The Religious Texts module searches Sefaria's library on demand through its
public search API. It displays short excerpts, citations, edition and language
metadata, and links each result back to Sefaria. The panel also links to Bible,
Qur'an, and Buddhist text portals; those are external searches, not embedded
Studio connectors. Sefaria documents public API access without API keys. Texts
are requested live and are not mirrored.

Critical Text Edition stores project metadata, manuscript witness descriptions,
text loci, edited readings, variant types, and editorial notes in browser
storage. It builds an apparatus from witness readings and supports project JSON
import/export plus TEI XML download. Browser storage is device-local; use JSON
export for backup or transfer. Review and validate the TEI output against the
project's target schema before publication.

Corpus Linguistics stores corpus metadata, text documents, character-offset
annotations, and manually aligned parallel passages in browser storage. It
provides Unicode-aware concordance search with context, case and whole-word
options; annotation categories for part of speech, lemma, morphology, named
entities, semantics, and other labels; DOCX, TXT, and MD text import; project
JSON import/export; and CSV export of the current concordance. Browser storage
is device-local; use JSON export for backup or transfer. Additional disciplines can add modules through the same manifest and contribution system.

The Statistical Analysis module imports CSV/TSV datasets and converts measurement records from Experimental Laboratory project JSON into an analysis table. It calculates descriptive summaries, t-based confidence intervals, Welch's independent two-group t-test, one-way ANOVA, and ordinary least-squares simple linear regression. Its JSON report records the dataset, selected variables, methods, results, and caveats. Calculations run in the browser and data stays in local workspace storage; this initial implementation does not replace R/Python, assumption diagnostics, power analysis, nonparametric methods, or multiple-testing correction.

These discipline workspaces are research aids and do not verify legal validity, resolve authorities, or provide shared storage. Legal Sources does not ingest external search results; researchers record and verify primary-source links themselves. MusicXML import covers uncompressed XML files.

Configure the server-side module allow-list with `STUDIO_ENABLED_MODULES`, the
Europeana key as `EUROPEANA_API_KEY`, and the read-only NARA key as
`NARA_CATALOG_API_KEY`. Neither key may be exposed in
frontend configuration. Searches are on demand; catalogues are not mirrored. The NARA search displays the attribution notice required by its API terms.

## Module manifest

A module has a stable qualified ID, semantic version, supported module API
version, host translation keys, optional discipline IDs, required capability
IDs, and declared contributions. The host validates manifests and rejects
duplicate IDs, invalid identifiers, duplicate contributions, and unsupported
API versions.

Contribution slots in API version 1 are:

- `workspace-home`: an entry on a research workspace landing page.
- `workspace-tools`: an action or tool exposed in a workspace.
- `research-navigation`: a module destination in research navigation.

Translations stay in Studio's locale system. Manifests refer to translation
keys rather than shipping untranslated user-facing strings.

## Activation and authority

There are two separate decisions:

1. An installation administrator enables a module for the Studio installation.
2. A researcher activates an enabled module for a specific workspace.

The shared resolver expresses those states for UI and policy evaluation. The
installation operator controls the allow-list through the server-side
`STUDIO_ENABLED_MODULES` setting. User selections are stored in the Studio
database by authenticated user and workspace ID, with revision checks to avoid
stale updates. The client imports existing browser selections once when no
server preference exists. Current module scopes are user-owned; shared-workspace
membership is not yet part of the module authorization model.

The server checks the installation allow-list, the authenticated user's
workspace-scoped active-module preference, and the module's declared capability
on every protected operation. A successful check creates a request-scoped
execution grant and writes an audit event without storing the external search
query. The external search routes use the versioned `/api/v1/modules/...`
namespace. Capability declarations describe the operation being requested;
they do not grant access by themselves. Preference writes use a monotonically
increasing revision and return a conflict for stale updates.

## Loading and integration rules

Version 1 registers trusted modules in Studio's own source tree. A registry
entry is metadata only; module code remains part of the reviewed Studio build.
Do not evaluate arbitrary JavaScript, HTML, or remote bundles from a manifest.
When third-party distribution is considered, it needs a separate signed,
sandboxed extension design and a security review.

A module should integrate through named contribution slots and provider-neutral
service interfaces. It must not import another discipline module's internals,
access Prisma or databases directly, or put service credentials in OMI files.
External archives and other providers belong behind server-side connectors;
provider credentials and authorization stay server-side. Every external provider
or record link in a module must open in a new tab or window with
`target="_blank"` and `rel="noopener noreferrer"`, so the researcher keeps the
Studio workspace open.

## Manuscript contribution and data boundary

The editor's **Insert module section** action inserts only the module's localized
title and description. It does not read browser or IndexedDB research records,
serialize workspace JSON, or silently copy transcripts, participant data, legal
notes, measurements, source material, or other module state into portable OMI.
Existing manuscript sections are unaffected. The action is a manuscript
structure aid, not a data export.

Research workspace records remain separately owned, locally stored module data.
Their current project JSON downloads are user-initiated backups or transfers;
they are not OMI manuscript snapshots and do not acquire OMI-SPEC-320
compatibility guarantees. Browser storage may be cleared, unavailable, or
device-specific. Users should retain an explicit export for important records;
sensitive projects require an appropriate storage and retention policy.

A future module-to-manuscript contribution must declare a typed, versioned
projection with an allow-list of fields, provenance and loss diagnostics.
Every copied excerpt must have a required source record/citation or clearly
identified researcher-authored source, represented in the portable manuscript
and visibly rendered beside the excerpt. Before insertion the researcher must
see the exact text and source together and explicitly confirm both. The projection must exclude confidential or identifying material by
default, validate the resulting OMI blocks, and run through an application
command with undo/revision behavior. A source label by itself does not authorize copying confidential records, and
anonymous projections must not expose participant or reviewer identity. No
module may treat its raw workspace record as Tiptap or OMI content. Review-confidential data needs a separate
authorization and de-identification boundary.

## Follow-up implementation

Add installation-administrator UI for the server-owned module allow-list and
integrate shared-workspace membership when the server workspace model is ready.
Expand the History and Archives module with other provider adapters and add jurisdiction-specific legal-source connectors where official APIs are available.
