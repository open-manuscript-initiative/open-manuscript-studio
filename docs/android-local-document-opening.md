# Android local document opening — 2026-11-06

The three local entry points now share the same strict OMI byte reader:

- The visible web opener in `StudioMenuWithHelp` accepts both `.omi` ZIP packages and `.omi.json`. The earlier #870–#873 changes reached the fallback `StudioMenu` opener, while the normal wrapper still filtered JSON and attempted `JSON.parse` on ZIP bytes.
- The native picker requests `*/*` for opening. Android providers can classify `.omi` downloads as `application/octet-stream`. JSON saving retains the specific `application/json` MIME type.
- The native main WebView now grants `fs:allow-read-file`, required by the actual binary read operation and the save readback checks added in #874. No broad filesystem scope is added.

The Android-only configuration declares OMI, JSON, ZIP and generic binary MIME associations for View and Send. The installed app can therefore be selected in the file manager's **Open with** or **Share** menu, including providers with opaque `content://` URLs. Android matches MIME types, so Studio can also appear for unrelated binary/JSON/ZIP files; content validation rejects those files.

Tauri's Android `RunEvent::Opened` queues content URIs until the authenticated Studio UI can receive them. The main WebView subscribes before draining that queue. Cold starts, warm opens, duplicate notifications and effect replay use a serialized receiver. Received files open as copies without retaining a write destination. HTTPS/OAuth URLs are excluded. Failed imports show an error and leave the current document available after dismissal.

The common reader preserves manuscript/revision identity, checks package integrity and revision digests, restores packaged media, and rejects empty files. A previously saved **0-byte** file has no recoverable document content; save a fresh copy from the intact local or cloud document.

## Validation

- Production TypeScript/Vite build passed.
- Local/native regressions passed, including JSON/ZIP round trip with binary media, malformed/empty files, cold/warm receipt, repeat opens and effect cleanup during reading.
- Existing asset-container, native editorial workflow and publication-sidecar regressions passed.
- Modified TypeScript passes ESLint; Android association entries validate against the pinned Tauri CLI 2.12.1 schema.
- Mobile browser UI regression added for the actual wrapper opener, both formats and empty-file feedback. Local execution was blocked before browser startup by this environment's `socket() ... Operation not permitted` restriction; CI/device execution is still required.
- Native Rust/Android compilation and real-device file manager/SAF tests remain to be verified in CI and on device. No successful physical-device round trip is claimed.

## Device acceptance after installation/deployment

1. Update the installed Android app (APK baseline versionCode 1354; the Play release workflow continues deriving a higher code per run). A web deployment alone cannot update native permissions or associations.
2. Save a fresh, nonempty `.omi` package containing a note and image, and an `.omi.json` document.
3. Open each through the app's document picker and through the mobile web document opener. Include a BIN-classified `.omi` download.
4. In Files/Downloads, choose Open with → OMI Studio, first with Studio closed, then with Studio already open; repeat for the same file. Also check Share → OMI Studio.
5. Verify text, notes, images and revisions. Reject a zero-byte/invalid file visibly and verify the previous document remains available.
6. Check desktop local opening/saving and cloud reopening as regressions.
