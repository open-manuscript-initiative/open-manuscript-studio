# Reference-manager integrations

Open Manuscript Studio keeps bibliographic records in the portable OMI
manuscript model. External reference managers are adapters around that model;
they are not authoritative stores for the manuscript itself.

## Supported integration paths

| Source | Connection | Current direction |
| --- | --- | --- |
| Zotero personal library | Personal Zotero Web API key | Read/search/import/refresh into OMI |
| Mendeley personal library | OAuth 2.0 authorization code | Read/search/import/refresh into OMI |
| RIS file | File import | Import into OMI |
| BibTeX file | File import | Import into OMI |
| CSL JSON file | File import | Import into OMI |

RIS, BibTeX, and CSL JSON provide an interoperability bridge for other
reference managers that can export one of these common formats. This keeps the
Studio core independent from vendor-specific desktop databases and private
file layouts.

## Security and ownership boundary

Reference-manager connections belong to the signed-in user's personal
integration profile.

Studio does not ask for a Zotero or Mendeley password.

- Zotero personal API keys are stored as encrypted integration secrets.
- Mendeley access and refresh tokens are encrypted server-side.
- Encryption uses the deployment's `INTEGRATION_MASTER_KEY`.
- Reference-manager integrations currently declare only
  `references.read`.
- Import and refresh do not write back to the external Zotero or Mendeley
  library.

The OMI bibliographic record remains the object cited by the manuscript.
Provider IDs are retained only as external source identifiers.

## Zotero

The current Zotero connector targets the user's personal library.

1. In Zotero account settings, create an API key with permission to read the
   personal library.
2. In Studio open **Integrations → Zotero**.
3. Paste the personal API key and save the connection.
4. Use **References** to search the connected Zotero library.

The key is sent to Zotero in the `Zotero-API-Key` header and Studio pins the
Zotero Web API version header to version 3. It is never appended to a URL.

A Zotero record imported into OMI retains its Zotero item key. Opening that OMI
record later exposes **Refresh from Zotero**. Refresh loads the current external
metadata into the editor but does not change the manuscript until the user
presses **Save**.

## Mendeley

Mendeley requires a server-side OAuth application. Configure:

```dotenv
MENDELEY_CLIENT_ID=...
MENDELEY_CLIENT_SECRET=...
MENDELEY_REDIRECT_URI=https://studio.example.org/api/integrations/mendeley/oauth/callback
```

The redirect URI must match the URI registered for the Mendeley application
exactly.

In Studio, choose **Integrations → Mendeley → Connect Mendeley**. The provider
authorization page is opened outside the Studio editor. The server exchanges
the returned authorization code and stores the encrypted token set. Expired
access tokens are refreshed using the stored refresh token.

An imported Mendeley document retains its external document ID and can later
be refreshed from the bibliographic record editor without changing the stable
OMI record ID.

## RIS, BibTeX, and CSL JSON

Open **References → Import library** and select one of:

- `.ris`
- `.bib` or `.bibtex`
- `.json` or `.csljson` containing CSL JSON

Studio maps supported metadata to OMI bibliographic records and keeps source
keys where the format supplies them.

Bulk import performs conservative duplicate detection. A record is skipped
when it would duplicate an existing DOI, or when normalized title, creator, and
date evidence identifies the same work.

Malformed or untitled entries are reported as import warnings rather than
being inserted as invalid bibliographic objects.

## Refresh semantics

Refresh is intentionally **review-before-save**.

1. Studio resolves the external provider identifier stored on the OMI record.
2. The server fetches that exact provider record with the user's connection.
3. Fresh metadata is mapped to an editable OMI draft.
4. The stable OMI record ID is retained, so existing citation targets remain
   valid.
5. Locally managed identifiers that are outside the provider-managed set are
   retained.
6. The manuscript changes only after the user reviews the draft and saves it.

Provider-managed DOI/ISBN/ISSN/PMID/arXiv values can therefore follow the
external source without breaking manuscript citation identity.

## Deliberate limitations

The current direct Zotero connector is for personal libraries; group-library
selection is not yet exposed.

The Mendeley search adapter currently works against the user's document
collection and is optimized for interactive lookup rather than mirroring the
entire remote library.

Two-way synchronization is intentionally not enabled. External-library writes
would require a separate permission and conflict-resolution model and must not
be implied by the current `references.read` scope.
