# Local-first manuscript storage

The installable Open Manuscript Studio treats the manuscript as an author-controlled portable document rather than as data that must live on an OMI server.

## System storage is enabled by default

Every installed Studio build uses the operating system's own document/file surface as its primary storage integration. This is not an optional cloud plugin and does not require a provider account to be configured in Studio.

On Windows, macOS and Linux, the native picker can expose locations such as:

- local Documents and Downloads folders;
- synchronized OneDrive, Dropbox, Google Drive, iCloud Drive, Nextcloud or similar folders;
- mounted NAS or network drives;
- external drives and removable media.

On Android, Studio uses the system Documents / Storage Access Framework picker. It can therefore save to device storage, SD cards and document providers exposed by installed storage applications. iOS uses the corresponding system file-provider surface.

Cloud synchronization remains the responsibility of the operating system integration or the selected provider application. OMI does not require provider credentials when the destination is already available through the system picker.

## Commands

- **Open** selects an existing OMI manuscript and makes that document target current for the running application session.
- **Save** writes to the current document target. If the manuscript has no current target, it behaves as Save As.
- **Save As / Save to another location** opens the system picker and makes the selected target current.
- Portable OMI packages and supported export formats use the same system save surface in installed builds.

The hosted web Studio retains browser download/export behavior and does not receive unrestricted filesystem access.

## Direct cloud provider settings

Cloud provider settings are reserved for cases where Studio itself must connect directly to a service through a protocol or provider API, for example WebDAV or a future OAuth-based provider integration.

System-visible OneDrive, SharePoint, Google Drive, Dropbox, Nextcloud, iCloud Drive and similar locations do **not** need a second provider-specific folder configuration inside Studio. If the operating system or provider app exposes the location, authors can use it directly from the normal Open, Save and Save As workflow.

This keeps the default experience consistent across installed platforms while retaining direct provider connections for deployments that actually need server-managed cloud access.

## Security boundary

The Tauri shell enables narrowly scoped native open/save dialogs and file operations. The intended security model is explicit author selection: the application does not scan arbitrary folders or request broad shared-storage access.

On Android, document-provider URIs are handled through the system picker rather than through blanket storage permissions. On desktop, Studio accesses only paths selected through normal native file/folder interaction.

## Offline operation

Local/system file open and save do not require the OMI server. Features that depend on remote services (for example OJS integration, online bibliographic lookup, collaboration, direct cloud APIs or server synchronization) may still require network access.

## Portability

Application versioning and OMI document-schema versioning remain separate. A manuscript file is intended to remain portable across Studio releases and, ultimately, across independent OMI-compatible implementations.
