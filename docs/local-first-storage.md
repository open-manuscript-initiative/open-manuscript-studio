# Local-first manuscript storage

The installable Open Manuscript Studio treats the manuscript as an author-controlled portable document rather than as data that must live on an OMI server.

## Own-device mode

Every signed-in user can decide locally whether the current installation is running on their own device.

- **Own device enabled:** native system storage is available as a normal working location. Studio may keep the current document path during the app session.
- **Own device disabled:** the machine is treated as shared or foreign. Profile cloud storage is the normal save path and Studio does not retain a local working-file path.

This preference is deliberately device-local and user-scoped. It is not synchronized to the profile because the same author may trust an office computer but not a borrowed computer.

A newly seen device defaults to shared-device mode until the author explicitly marks it as their own device.

## System storage on an own device

The native application can open and save `.omi.json` manuscript files through the operating system's file picker. The author may therefore choose any location exposed by the operating system, including:

- a local Documents folder;
- a synchronized OneDrive, Dropbox, Google Drive, iCloud Drive, Nextcloud or similar folder;
- a mounted NAS or network drive;
- an external drive.

Cloud synchronization remains the responsibility of the selected cloud provider when its folder is mounted by the operating system. OMI does not require provider credentials for this mode.

On Android the equivalent surface is the system Documents / Storage Access Framework picker. Available document providers may include internal storage, Downloads, SD cards and cloud apps installed on the device.

## Portable storage on a shared or foreign device

Shared-device mode still permits explicit use of removable storage such as a USB flash drive.

The user chooses the removable device through the operating system file picker. Studio cannot reliably distinguish a USB drive from every other mounted volume on all supported operating systems, so it applies a stricter semantic rule instead:

- opening from portable storage reads the selected manuscript without retaining the path as the current working file;
- saving to portable storage creates a one-off copy and does not retain the selected path;
- portable `.omi.zip` backup export remains available;
- normal local Save / Save As is disabled as a persistent workflow in shared-device mode.

This prevents a borrowed computer from silently becoming the manuscript's remembered working location.

## Profile cloud storage

Direct cloud connections belong to the authenticated user profile. The server stores each cloud connection under the authenticated user ID and returns only that user's connections.

This means a configured direct WebDAV or Nextcloud connection follows the user when they sign in on another device. Credentials remain encrypted on the Studio API server.

The intended shared-device workflow is therefore:

1. sign in;
2. keep **This is my own device** disabled;
3. work with a profile cloud connection;
4. optionally create a one-off copy on a USB drive or other removable storage.

Direct OAuth integrations for additional providers can follow the same profile-scoped model when implemented.

## Security boundary

The own/shared-device choice controls persistence semantics, not low-level operating-system permissions. The native file picker always requires an explicit user selection.

The Studio does not scan disks, automatically discover removable drives, or upload local filesystem paths to the server.

## Offline operation

Own-device local file open/save does not require the OMI server. Shared-device profile cloud storage requires network access, while one-off portable-storage open/save remains local.

Features that depend on remote services, such as OJS integration, online bibliographic lookup or collaboration, may also require network access.

## Portability

Application versioning and OMI document-schema versioning remain separate. A manuscript file is intended to remain portable across Studio releases and, ultimately, across independent OMI-compatible implementations.
