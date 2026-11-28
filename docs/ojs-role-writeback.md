# Returning editorial tasks to OJS

The matching OJS plugin change is version **1.12.0.0**. Install it before deploying this Studio change and applying the `20261128040000_ojs_role_writeback` database migration. Translation profiles also require the identity migration `20261128050000_translation_profile_languages` and Studio migration `20261128050000_translation_assignment_languages`. Older plugins return a visible transfer error rather than an apparent successful document return.

| Role | Identity policy | Native OJS destination |
| --- | --- | --- |
| Scientific reviewer | Double anonymous | The specific native reviewer assignment and review round; reviewer attachments, peer-review comments, assigned native form and recommendation |
| Language reviewer | Open collaboration | The authorized submission workflow stage and native discussion |
| Translator | Open collaboration | The authorized submission workflow stage and native discussion; distinct source/target languages required |

Scientific review does not expose author metadata, comment-author names, source filenames or account identifiers in the returned files. Language review and translation preserve public author metadata and allow named participants. Confidential annotations are stored only for the editor, outside the shareable DOCX and structured snapshot. Free text in an OJS reviewer source file remains the text approved by the journal for that review round.

## Closing document access

A scientific reviewer can read an invited/active task and edit an accepted/in-progress task. Submitting the scientific review immediately closes the manuscript pane and revokes the participant's original/working-document API access. Only transfer status and retry controls remain, so a failed OJS transfer can be retried without reopening the manuscript. Native OJS reviewer launch assertions and file reads are also refused after native review completion.

Translators and language reviewers retain document access, including after submitting work for editorial checking, until the editor marks the task `COMPLETED`. Editing submitted open work returns it to `IN_PROGRESS` and invalidates the previous transfer receipt. A subsequent submission creates a new native OJS version; retrying that same version does not duplicate it. Editorial completion and saving use conditional database updates, so a concurrent save cannot reopen a completed task. The workspace refreshes task state on focus and every 15 seconds and clears closed document content.

## Translation language pairs and mandatory work

Translators configure directional source/target pairs in their personal profile, for example `hu → en` and `hu → de`. Locale country suffixes normalize to the language; explicit scripts remain distinct. The task list shows only assigned tasks in configured pairs and groups each pair separately. The server applies the same restriction to direct reads, acceptance, drafts, feedback and submission. A missing or mismatched profile opens a settings dialog before work starts; this cannot grant access to a task assigned to somebody else.

Every translation requires a translated **title, abstract and keywords**. Drafts can be saved incomplete, but submission and OJS transfer require all three. OJS updates only that target metadata locale, retaining the source and all other translations.

The full manuscript is required only if the target is a full-text publication language. The source publication locale and existing galley locales count as actual languages. The editor can also select a planned full-text language when assigning the translator. Enabled OJS metadata/interface languages alone do not make body translation mandatory. The signed native task binding records the language pair and publication version, and OJS rechecks the current scope when receiving work.

Metadata-only tasks show the original manuscript for reference and return no DOCX or source-body replacement. Full-text tasks require completion confirmation and return language-labelled Word/structured files in addition to localized metadata. Primary-language source loading excludes returned translation files in another language.

## Data preservation

The review model retains stable block/comment IDs, selected quotes and offsets, rich inline text, structured blocks, comment visibility, replies and resolution state. Deleting the target of a comment does not delete the comment. An unresolved source range remains available for correction.

OJS receives a corrected DOCX containing real Word comments and a paired `.omi-review.json` file for exact structured reopening. Confidential feedback is returned separately to the native peer-review comment or a restricted native discussion. The original OJS manuscript is preserved; returned files are additional native file records. OJS editor/author reopening can select the latest authorized workflow document and use its paired snapshot. Reviewer access remains limited to the files OJS selected for that review round.

## Failure and retry

Local task submission and OJS return are displayed separately. Transfer errors remain visible after reloading the task. A participant can retry without resubmitting the completed local task. Native OJS receipts prevent duplicate documents, notes and discussions after a response is lost. A success receipt is checked against the submission, assignment, document count and checksums.

Existing tasks created before external bindings were stored can be repaired from the OJS manuscript's **Participants and assignments → Restore OJS connection** control. Only an editor authorized by a fresh OJS launch can repair a task. Existing revisions are preserved. A task cannot be moved silently to another review round. Historical annotations already discarded by older versions cannot be reconstructed automatically.

## Validation

- `npm run test:ojs-role-writeback`: real source model, Word export, client status and backend transfer tests with isolated external dependencies.
- Existing OJS footnote, inline semantics and structured-table import tests.
- Frontend TypeScript build and server typecheck.
- Matching plugin: `php tests/role-writeback.php`, exercising the actual controller against in-memory PKP repositories, including role policy, native file stages, privacy, replay, authorization and rollback.
- A privately supplied Word document with **139 comments** retained all 139 in source parsing, review storage and a shareable test Word export in both identity modes; all source anchors resolved in that sample. No manuscript content is included in this repository.

These tests do not constitute a production OJS deployment test. After merging both changes, verify one task per role against the deployed OJS installation, including a deliberately failed transfer followed by retry.
