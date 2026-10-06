# Studio discipline module framework

## Scope

A Studio module adds an optional research workflow for one or more disciplines.
The module system is separate from OMI manuscript semantics: modules may use
Studio services and external providers, but must not change the OMI document
model merely to store module-specific state.

The framework provides provider-neutral manifests, a validated in-process
registry, contribution slots, capability declarations, and two-level activation.
The Studio menu opens a module manager and hosts the built-in discipline
modules. History and Archives searches Europeana and the U.S. National Archives;
Religious Texts searches Sefaria; Critical Text Edition provides an edition
workspace for witnesses, collation, apparatus, and TEI export. Corpus Linguistics
supports corpus search, linguistic annotation, and parallel-text alignment.
Musicology imports MusicXML scores and stores musical events alongside recording references. Cultural Heritage catalogs objects and sites with descriptive metadata and image-region annotations. Social Research Methods provides a project design, codebook, transcript editor, and character-offset coding. Legal Sources tracks citations and dated source versions with side-by-side text comparison. Research Reproducibility links publications to versioned outputs and can calculate a SHA-256 checksum for a selected file without uploading it.
All five workspaces persist locally in the browser and export JSON for transfer. They do not load remote code.

## Built-in module catalog

The initial catalog includes these modules:

| Module | Disciplines | Planned scope |
| --- | --- | --- |
| History and archives | History, archival studies | Search Europeana's shared cultural heritage catalogue and NARA's federal archival descriptions, and open the eLevéltár portal for Hungarian archival descriptions from the Hungarian National Archives and Budapest City Archives. |
| Religious texts | Theology, religious studies | Search Sefaria's Jewish text and commentary library live, display short excerpts with citation and edition metadata, and link to Bible, Qur'an, and Buddhist text portals. The first embedded full-text connector covers Sefaria only. |
| Critical text edition | Philology, classical philology, literary studies | Manage transcriptions, textual variants, manuscript witnesses, critical apparatus, and digital editions. |
| Corpus linguistics | Linguistics | Search corpora, produce concordances, align texts, and annotate linguistic features. |
| Musicology | Musicology | Work with notation and musical events, align scores and recordings, annotate passages, and compare variants. |
| Cultural heritage | Archaeology, art history, museum studies | Describe objects and sites with people, events, dates, and places, and annotate image regions. |
| Social research methods | Social sciences, behavioral sciences, economics | Organize survey instruments, variables, codebooks, interview coding, datasets, and methods. |
| Legal sources | Law | Search legislation and court decisions, track jurisdiction and effective dates, cite provisions and cases, and compare versions. Provider access is jurisdiction-specific. |
| Research reproducibility | Natural sciences, engineering | Relate publications to versioned datasets, code, methods, supplemental materials, and research repositories. |

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

These five workspaces are client-side research aids and do not verify legal validity, resolve authorities, or provide shared storage. The Legal Sources workspace does not fetch legislation or case law from provider APIs; researchers record and verify primary-source links themselves. MusicXML import covers uncompressed XML files.

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

## Follow-up implementation

Add installation-administrator UI for the server-owned module allow-list and
integrate shared-workspace membership when the server workspace model is ready.
Expand the History and Archives module with other provider adapters and add jurisdiction-specific legal-source connectors where official APIs are available.
