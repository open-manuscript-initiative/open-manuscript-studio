# Document save actions and cloud connection settings

The Studio's **Document** menu is the owner of manuscript save actions. The **Integrations** panel configures cloud-provider connections and credentials; configuration is deliberately separate from saving the current manuscript.

## Document menu

- **Save / Save As**: existing native own-device file handling (Windows, macOS, Linux, Android and supported iOS environments); no new path resolution or storage format rules introduced.
- **Portable document copy / portable OMI backup**: existing file delivery workflows. The browser Document menu also exposes the existing validated portable OMI backup action, without presenting it as a native filesystem save.
- **Cloud manuscript backup**: uses the existing connected storage account to upload an OMI container; lists, restores and deletes existing backups. All upload and import/restore validation checks remain unchanged.
- **Saved documents** and DOCX/ODT imports remain within Document.

## Integrations and Settings

The shared `CloudStorageSettings` component is rendered as either:
- `view="connections"` (default): own-device preference, cloud provider authorization, connections, test and disconnect actions; **no save or restore buttons**.
- `view="documents"`: cloud backup/restore actions; **no account credentials or connection form**.

The own-device selection still controls where the native filesystem actions appear. Existing OMI container validation, explicit connection selection, authentication and storage APIs are preserved. No new server API/database migration, cloud provider credential transfer, silent automatic synchronization, or implicit overwrite of a remote file is introduced.

**Terminology:** the current cloud operation is an OMI *backup upload*, not yet a durable editable cloud-document binding with default provider and version-aware overwrite. A true `Save` to cloud (reusing the chosen remote path without creating new backups, conflict/version handling, selective first-time destination setup) is a separate follow-up capability and must not be implied by this UI relocation.

## Regression / manual acceptance

- `node --test tests/document-storage-placement.test.mjs`
- `npm test` and `npm run build`
- Test native Save/Save As on own devices and portable copy on shared devices.
- From the Document menu, upload an OMI backup to an existing connected provider, list it, restore it, and verify no text/footnote/reference loss.
- From Integrations, connect/test/disconnect providers without any document-save controls, and ensure the settings location shows connection settings only.
- Verify on desktop, mobile and browser, in Hungarian and supported locales.
