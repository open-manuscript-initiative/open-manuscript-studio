# Local-first manuscript storage

The installable Open Manuscript Studio treats the manuscript as an author-controlled portable document rather than as data that must live on an OMI server.

## Storage locations

The native application can open and save `.omi.json` manuscript files through the operating system's file picker. The author may therefore choose any location exposed by the operating system, including:

- a local Documents folder;
- a synchronized OneDrive, Dropbox, Google Drive, iCloud Drive, Nextcloud or similar folder;
- a mounted NAS or network drive;
- an external drive.

Cloud synchronization remains the responsibility of the selected cloud provider. OMI does not require credentials for those providers when their folders are mounted by the operating system.

## Commands

- **Open** selects an existing OMI manuscript and makes that path the current document path.
- **Save** writes to the current document path. If the manuscript has no current path, it behaves as Save As.
- **Save As** asks for a new location and makes the selected path current.

The web Studio retains browser download/export behavior and does not receive unrestricted filesystem access.

## Cloud provider settings

In the desktop application, a locally synchronized folder is a **connection method of the actual cloud provider**, not a separate cloud service. For example, OneDrive, SharePoint, Google Drive, Dropbox, Nextcloud and iCloud Drive can use a folder that their installed desktop client already synchronizes.

Studio remembers the selected folder locally per signed-in user, provider and account type. The path is not uploaded to the Studio API. Studio writes the portable OMI package into that folder, while the provider's own client remains responsible for authentication, conflict handling and cloud synchronization.

Web and mobile clients do not receive unrestricted filesystem access; they expose only connection methods available on those platforms.

## Security boundary

The Tauri shell enables only native open/save dialogs and text-file read/write operations. The intended security model is explicit author selection: the application does not scan cloud folders or arbitrary filesystem locations.

## Offline operation

Local file open/save does not require the OMI server. Features that depend on remote services (for example OJS integration, online bibliographic lookup, collaboration or server synchronization) may still require network access.

## Portability

Application versioning and OMI document-schema versioning remain separate. A manuscript file is intended to remain portable across Studio releases and, ultimately, across independent OMI-compatible implementations.
