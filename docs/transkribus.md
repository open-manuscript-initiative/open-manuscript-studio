# Transkribus integration

Studio connects a researcher's own Transkribus account to the **Critical text edition** module. It submits a single page image for handwriting or printed-text recognition, tracks the job, and lets the researcher correct and explicitly insert the result into an existing manuscript section. Transkribus credits are used only when the researcher approves processing and presses **Start recognition**.

## Using the integration

1. Open **Integrations → Transkribus** and connect your READ-COOP / Transkribus account. The provider currently requires API access on a Scholar plan or above.
2. Enable **Critical text edition** under **Settings → Research modules**.
3. In **Research modules → Critical text edition → Transkribus**, select a JPEG, PNG or TIFF page image, up to 20 MiB. Convert PDF pages to individual images first.
4. Enter the ID of an appropriate handwriting/print model from the [Transkribus model catalogue](https://www.transkribus.org/models) or your account. Studio does not assume that one example model is suitable for every script or language. The current API does not expose model discovery.
5. Approve sending that image to Transkribus and consuming credits, then start recognition. Submissions are never retried automatically: if a request was interrupted, inspect Transkribus before submitting again.
6. The current device saves the most recent job separately for each Studio account and workspace, so reopening the screen can resume status checks. A polling error pauses automatic checks; **Refresh status** retries a read without creating a new paid job.
7. Compare the transcription with the original, correct the text, replace the suggested filename with an archival source or stable URL, declare the source rights, select the target manuscript section, and confirm the review. **Insert reviewed transcription** appends the text without replacing existing content.
8. Download the corrected plain text and the original PAGE XML promptly. The XML contains the provider's original transcription and layout; editing the Studio preview does not rewrite that XML. Provider retention is limited; the documentation and product page currently differ on its exact duration.

Third-party transcriptions receive visible source text, a provisional bibliographic record and a `prov:wasDerivedFrom` source relationship. Rights are an author declaration; no licence is inferred. For an author's own source created outside OMI, Studio retains hidden origin metadata instead of publishing a filename as a citation. Every insertion retains provider, process ID, model ID, review and rights metadata. Credentials and job authorization handles are never included in the manuscript.

## Authentication and deployment

The integration uses the provider's documented OpenID Connect password exchange with client ID `processing-api-client`. The password is used once and is not persisted. Access and refresh tokens are encrypted with the existing `INTEGRATION_MASTER_KEY` in the account's `UserIntegration` record. Tokens stay on the Studio API server and are refreshed as needed. Disconnecting removes local credentials before best-effort provider logout; an in-flight refresh cannot recreate a deleted connection. No database migration or server-wide Transkribus account is required.

All recognition and result routes require a Studio session and the `transkribus.recognize` capability of an installation-enabled, workspace-active `org.omi.critical-text-edition` module. Job handles are signed and bound to the Studio account. Requests use fixed HTTPS provider origins, reject redirects, bound response size, and do not follow untrusted response links. This also avoids browser/WebView cross-origin differences: the web, desktop and mobile clients all use their selected Studio API server.

The default processing origin is the production endpoint advertised by Transkribus:

```dotenv
TRANSKRIBUS_API_ORIGIN=https://api.transkribus.org
```

The developer guide currently uses `https://api-staging.transkribus.org`. An administrator may explicitly select that origin for provider-directed beta testing; Studio never falls back to staging automatically. Only these two origins are accepted. Restart the API after changing this setting. The READ-COOP token endpoint remains fixed at `https://account.readcoop.eu/auth/realms/readcoop/protocol/openid-connect/token`.

Studio accepts the 20 MiB image as base64, so a reverse proxy must allow at least a 28 MiB request body on the recognition route. The API applies that larger body limit only to the authenticated recognition path. Account connection and paid submissions have separate per-user rate limits. Existing deployments with an explicit `STUDIO_ENABLED_MODULES` allowlist must include `org.omi.critical-text-edition`.

### API routes

| Route, relative to `/api` | Purpose |
| --- | --- |
| `GET /integrations/transkribus/connection` | Non-secret account connection status |
| `POST /integrations/transkribus/connection` | Exchange credentials and store encrypted tokens |
| `DELETE /integrations/transkribus/connection` | Disconnect and revoke the refresh session where available |
| `POST /modules/critical-text-edition/transkribus/jobs?workspaceId=…` | Submit an image with `modelId`, `imageBase64`, `consent: true` |
| `GET /modules/critical-text-edition/transkribus/jobs/:handle?workspaceId=…` | Read status and transcription |
| `GET /modules/critical-text-edition/transkribus/jobs/:handle/page?workspaceId=…` | Download the original PAGE XML as an attachment |

## Scope and verification

This is a recognition integration using the documented v2 API, not a replacement Transkribus editor. Collection synchronisation, model training, direct multi-page PDF processing and uploading corrections back to Transkribus are not implemented. There is no fake collection or model listing endpoint. A suitable paid account and a real recognition job are needed to verify account entitlement and recognition quality after deployment; automated tests use synthetic responses and consume no provider credits.

Run `npm run test:transkribus` for client contract, image bounds, authentication, authorization, token refresh/disconnect, source provenance, localization and manuscript round-trip coverage. The API tests use the existing generated Prisma clients, without requiring a running database.

## Magyar útmutató

Az **Integrációk → Transkribus** résznél csatlakoztasd a saját Transkribus-fiókodat. API-hozzáférést tartalmazó előfizetés szükséges (jelenleg Scholar vagy magasabb csomag). A jelszó nem kerül mentésre; a hozzáférési és frissítési tokeneket a Stúdió szervere titkosítva tárolja.

A **Beállítások → Kutatási modulok** alatt kapcsold be a **Kritikai szövegkiadás** modult. A modul Transkribus részében válassz egy legfeljebb 20 MiB-os JPEG-, PNG- vagy TIFF-oldalképet, add meg a megfelelő felismerési modell azonosítóját, majd engedélyezd az oldal továbbítását és a kreditfelhasználást. A **Felismerés indítása** gomb küldi el a képet. A PDF oldalait előbb képpé kell alakítani.

A kész átiratot ellenőrizd az eredeti alapján, javítsd a hibáit, add meg a forrást és a jogállást, majd válassz kéziratszakaszt. A jóváhagyott szöveg a szakasz végére kerül. A forrásmegjelölés és a gépi felismerés eredetadatai megmaradnak. Saját, OMI-n kívül készült forrás esetén külön szerzői nyilatkozat őrzi az eredetet.

Az átirat szövegfájlként, az eredeti felismerési eredmény PAGE XML-ként is letölthető. A Stúdióban javított szöveg nem módosítja az eredeti PAGE XML-t. A Transkribus korlátozott ideig őrzi az eredményeket, ezért mielőbb töltsd le őket. Sikertelen beküldés után az újraindítás előtt ellenőrizd a Transkribus-feladatot, hogy ne használj fel kétszer kreditet.

Az integrációhoz a frissített Stúdió API-t is telepíteni kell. A kiszolgáló alapértelmezetten az éles API-t használja; a dokumentációban szereplő staging kiszolgáló külön rendszergazdai beállítással választható. Ha a fordított proxy korlátozza a feltöltést, a felismerési útvonalon legalább 28 MiB-os kérést engedélyezz.

## Official references

- [Developer platform](https://docs.transkribus.org/)
- [Authentication](https://docs.transkribus.org/start/auth)
- [Recognition](https://docs.transkribus.org/processing/text-recognition)
- [Job lifecycle](https://docs.transkribus.org/processing/how-jobs-work)
- [API reference / OpenAPI](https://api-staging.transkribus.org/v2/openapi.json)
- [Production API overview](https://www.transkribus.org/transkribus-api)
