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
critical text edition, corpus linguistics, musicology, archaeology and cultural
heritage, social research methods, legal sources, and research reproducibility. Their specific
workflows are described in the catalog below. Most discipline workspaces persist
in browser storage and provide JSON export; the server stores module activation
preferences separately by user and workspace. The Musicology parser accepts
uncompressed MusicXML, ignores external DTD identifiers, rejects entity
declarations, and does not render notation. Modules do not load remote code.

## Built-in module catalog

The initial catalog includes these modules:

| Module | Disciplines | Current scope |
| --- | --- | --- |
| History and archives | History, archival studies | Search Europeana's shared cultural heritage catalogue and NARA's federal archival descriptions, and open official catalogues including eLevéltár for Hungarian archival descriptions, the Vatican Apostolic Library catalogue, and BeWeB for Italian ecclesiastical archives. |
| Religious texts | Theology, religious studies | Search Sefaria's Jewish text and commentary library live, display short excerpts with citation and edition metadata, and link to Bible, Qur'an, and Buddhist text portals. The first embedded full-text connector covers Sefaria only. |
| Critical text edition | Philology, classical philology, literary studies, philosophy | Manage transcriptions, textual variants, manuscript witnesses, critical apparatus, and digital editions; search philosophy and textual-studies scholarship in OpenAlex. |
| Corpus linguistics | Linguistics | Search corpora, produce concordances, align texts, and annotate linguistic features. |
| Musicology | Musicology | Import uncompressed MusicXML, catalog musical events, and link score events to recording timestamps. |
| Archaeology and cultural heritage | Archaeology, archaeometry, material culture, art history, museum studies | Document sites, contexts, stratigraphy, finds, samples and source records; describe heritage objects with provenance, rights and images; annotate image regions; search Pleiades, ARIADNE and Open Context. |
| Social research methods | Social sciences, behavioral sciences, economics | Record research design and ethics notes, maintain a variable codebook, and code selected transcript passages. |
| Legal sources | Law | Record jurisdiction, citations, dates, status, source links, and dated text versions; compare two saved versions side by side. Search EUR-Lex directly and open portal-scoped web searches for InfoCuria, the UN Treaty Collection, Roman law, and Vatican canon-law sources. External results are not imported. |
| Research reproducibility | Natural sciences, engineering | Link publications to versioned datasets, code, methods, software, supplements, repositories, persistent identifiers, licenses, and checksums. |
| Spatial research and GIS | Geography, GIS, spatial humanities | Register georeferenced objects, edit point coordinates, and import/export GeoJSON FeatureCollections while retaining declared coordinate reference information. No reprojection or map tile service is provided. |

| Experimental and laboratory research | Physics, chemistry, biology, materials science, agriculture, engineering, earth sciences | Organize investigations and studies with samples/materials, protocols, instruments/calibration, assays, measurements with units/uncertainty, and raw or derived artifacts. Profiles add agriculture field/plot/season, engineering system/design/test conditions, or geoscience sampling location/stratigraphy/coordinates. Search OpenAlex, USGS ScienceBase, INSPIRE-HEP, PubChem, and GBIF. |

Experimental and Laboratory Research uses an OMI module JSON schema with a versioned Investigation → Study → Assay structure. It supports physics, chemistry, biology, materials-science, agriculture, engineering, and earth-science profiles; sample/material registers; protocol steps; instrument and calibration records; measurements with unit, uncertainty, time, and instrument links; raw/derived/code artifacts; and local SHA-256 calculation. It does not upload selected local files or claim to serialize official ISA-Tab. Project records are stored in browser storage and can be imported/exported as module JSON.

Spatial Research and the combined Archaeology and Cultural Heritage module save project records in browser storage with portable exports. GeoJSON import preserves supported Point, LineString, Polygon, and Multi* geometry coordinates; the coordinate reference system is recorded as project metadata and is not transformed. Archaeology records group contexts and finds under one site/project and do not replace a formal excavation database. The combined module keeps the previous archaeology and cultural-heritage workspaces separate internally and preserves both storage keys when opening them together.

The History and Archives entry has on-demand Europeana Search API and U.S.
National Archives Catalog searches, plus a direct link to the official
eLevéltár archival search portal for Hungarian holdings. Europeana results link
to their Europeana record and, where available, the source institution; NARA
results link to the original catalog record. eLevéltár search opens in the
provider's portal because no supported public API endpoint has been confirmed.
The Vatican Apostolic Library is available as a link to its official online
catalogue, which includes archive and manuscript holdings; it opens at the
provider because no supported public search API has been confirmed.
BeWeB links to the Italian Episcopal Conference's archival catalogue, which
describes holdings from participating diocesan and other ecclesiastical
institutions; coverage depends on the institutions that have published data.
It opens at the provider and does not import or mirror catalogue records.
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

The combined Archaeology and Cultural Heritage workspace links to Pleiades, ARIADNE and Open Context searches. ARIADNE provides an aggregated archaeological catalogue; Open Context exposes a read-only search portal. These searches open at the provider and do not copy records into Studio. The Social Research Methods workspace also provides live ERIC search for education research. Experimental and Laboratory Research provides selectable live searches in INSPIRE-HEP (high-energy physics literature), PubChem (chemical compound records) and GBIF (biodiversity occurrence records). Search results stay inside the module with bounded bibliographic or record metadata and a link to the provider's individual record. The provider selection is stored per user, workspace and module. Queries are sent only after an explicit search action; protocol, ethics, participant and manuscript fields are never transmitted. Search records are not copied into the OMI manuscript automatically. Rights are displayed only when the provider supplies an explicit rights value; full-text availability is not treated as a reuse licence.\n\nThese discipline workspaces are research aids and do not verify legal validity, resolve authorities, or provide shared storage. Legal Sources does not ingest external search results; researchers record and verify primary-source links themselves. MusicXML import covers uncompressed XML files.

The ERIC, INSPIRE-HEP, PubChem, GBIF, OpenAlex and USGS ScienceBase connectors do not require API credentials in the current implementation. OpenAlex searches scholarly works across disciplines; ScienceBase provides USGS data releases and catalog records. Their public APIs are called from the Studio server using fixed HTTPS endpoints; the application does not proxy arbitrary URLs or store provider responses as manuscript content.\n\nConfigure the server-side module allow-list with `STUDIO_ENABLED_MODULES`, the
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
title and description. A separate **Select saved excerpt** action reads the
supported local module project only after the researcher opens it, exposes
allow-listed fields for explicit selection, and requires a non-empty source,
exact excerpt/source preview and an acknowledgement before inserting a visible
source line. The current typed projections cover critical-edition lemmas,
corpus documents, musicology events, cultural-heritage descriptions, legal-source
versions, reproducibility notes, spatial-feature notes, archaeological contexts,
laboratory protocol steps and the social-research methodology. Transcript,
participant, coding and ethics fields are never projected by this action. The
source may be edited by the researcher; Studio does not independently verify
that bibliographic claim. Other modules retain section insertion until they
have a reviewed projection. No action serializes raw project JSON or copies
arbitrary fields. Existing manuscript sections are unaffected.

Research workspace records remain separately owned, locally stored module data.
Their current project JSON downloads are user-initiated backups or transfers;
they are not OMI manuscript snapshots and do not acquire OMI-SPEC-320
compatibility guarantees. Browser storage may be cleared, unavailable, or
device-specific. Users should retain an explicit export for important records;
sensitive projects require an appropriate storage and retention policy.

The current excerpt projection is an initial, reviewed allow-list, not a full
OMI citation record. Its source is visible manuscript text. Formal bibliography
linkage, provenance/loss diagnostics, authorization for confidential datasets
and a versioned cross-module contribution contract remain follow-up gates;
these are required before claiming stable module interchange.

Every later module-to-manuscript contribution must declare a typed, versioned
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


## Mathematics equation workspace

`org.omi.mathematics` adds the existing equation authoring feature to the module
catalog, server installation allow-list and per-workspace activation settings.
New equation insertion lives in Modules and Insert → Research modules → Mathematics.
Existing equation blocks remain visible and editable even when the module is off.
The shared EquationEditor provides source entry, MathML preview, diagnostics and
selection-aware templates for fractions, roots, scripts, sums, integrals, matrices,
cases and aligned equations. It inserts the existing portable equation visual block
through `stageInsertBlocks`; no OMI schema changes or separate equation store are added.

The previous handwritten LaTeX parser could silently change mathematical meaning
(combined scripts, operators and unsupported commands). The pinned KaTeX 0.19.0
adapter replaces only that parser: it generates MathML, retains original LaTeX,
uses fresh macro state per call, disallows trusted link/image/HTML commands, and
bounds input length, macro expansion and user-specified sizes. Parse errors are
shown during editing, prevent new insertion, and fail HTML/JATS publication
validation. Exporters continue to consume the same adapter. KaTeX supports a
mathematical subset of LaTeX, not arbitrary packages, documents or symbolic algebra.
No CDN or external rendering service is needed. HTML and JATS renderer versions
advance to `0.1.0-alpha.2` to identify the changed mathematical output.
The JATS XML safety scanner examines brackets only inside the DOCTYPE
declaration, so preserved LaTeX annotations such as `\\sqrt[3]{x}` no longer
trigger a false internal-subset alarm. Actual internal subsets remain rejected.

This release does not add theorem/proof domain objects, inline editor nodes,
symbolic calculation or function plotting. External file/clipboard objects still
use the existing reviewed source/provenance import boundary.


Module display order in Settings, Modules and the module insertion menu follows
the localized display title using the current locale's collation. Registry IDs,
installation allow-lists and persisted activation preferences are unchanged.

## Psychology and Medical / Health Sciences

See [health research modules](health-research-modules.md) for structured protocols, instrument descriptions, ethics metadata, local-storage limits and allowlisted manuscript summary insertion. Both modules use the shared statistics workspace rather than introducing another computation engine.
