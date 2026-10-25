# Publisher profile downloads and shared catalog

All intake paths validate nested rule groups before activation and record SHA-256
over the exact imported bytes in `distribution.sha256`. Catalog hashes are also
compared before import. A hash identifies bytes; it does not authenticate a publisher.
Read-only metadata from a downloaded file is an unverified declaration.
Generic and humanities built-ins use version 0.2.0 for their new citation defaults;
explicit 0.1.0 references retain the historical rules. Unknown versions fail closed.

## Download and use a profile

A publisher can download each saved profile from **Publication → My publisher profiles** using its download button. Studio writes a portable `.omi-profile.json` file with the profile ID, version, publisher details, branding, publication rules, optional InDesign publication style, front-matter rules, and any existing protection metadata.

Publishers can place the downloaded file on their own HTTPS website. Another Studio user can import it from a file or by URL. URL imports require the publisher's web server to allow cross-origin requests (CORS); file import does not.

An imported profile is added to the user's local profile list and can be selected in the publication profile selector. Its ID and version are retained. Import provenance records the source URL, catalog URL where applicable, and import time. A protected profile remains read-only; use **Create editable copy** to customize it while preserving the original version.

## Shared catalog

Studio reads the public catalog index at `public/publisher-profile-catalog.json` in this repository. The catalog is a directory of profiles hosted by publishers; it does not mirror or own the profile files. Selecting an entry fetches the exact file from its publisher URL and checks its SHA-256 digest before import.

The index uses this structure:

```json
{
  "format": "omi-publisher-profile-catalog",
  "version": 1,
  "profiles": [
    {
      "id": "publisher:example-journal",
      "name": "Example Journal",
      "publisher": "Example Press",
      "version": "2026.1",
      "description": "Example journal publication profile.",
      "license": "CC BY 4.0",
      "url": "https://publisher.example/profiles/example-journal.omi-profile.json",
      "sha256": "64-character-lowercase-sha256-digest"
    }
  ]
}
```

Each catalog entry must include the exact profile ID, name and version, a publisher-hosted HTTPS URL, a license, and a SHA-256 checksum of the exact downloaded bytes. Studio verifies the checksum and checks the ID, name and version against the index before importing.

To add a profile to the shared catalog:

1. Export the profile from Studio and publish the file on the publisher's own HTTPS website.
2. Make sure the publisher's website permits cross-origin reads if users will import by URL.
3. Add an index entry with the profile metadata, license, URL and SHA-256 checksum.
4. Submit a pull request to this repository for review.

A local profile is never uploaded or published automatically. The catalog begins empty; only profiles whose publishers explicitly request catalog inclusion are listed.
