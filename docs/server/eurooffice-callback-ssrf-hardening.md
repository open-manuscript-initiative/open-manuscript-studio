# EuroOffice callback download SSRF hardening (RC1)

## Security boundary

The Studio API receives a JSON POST from the Office document editor at
`/api/v1/integrations/eurooffice/:documentId/callback?token=…`.
Only active editor sessions with a matching capability hash and document key
can save a DOCX; status 2 (final) and 6 (force-save) are recognized.
The callback supplies a `url` to download the edited DOCX. It must never
be treated as a general-purpose URL fetcher, even when its URL hostname
matches the configured Office origin.

## Hardening

- Validate the absolute callback URL against the **exact origin** of
  `EUROOFFICE_URL`. Require HTTPS; refuse mismatched origins, non-default
  ports, embedded URL credentials, URL fragments and invalid URLs.
- Replace global `fetch()` with the existing connection-pinned HTTPS
  transport introduced in #823. Both A and AAAA answers are checked
  at socket connection, not just during configuration. Literal private,
  loopback and cloud-metadata addresses are refused. Hostname, SNI and
  certificate verification continue to use the original HTTPS origin.
- Reject HTTP redirects rather than following them. The Office callback
  must supply a final direct DOCX download URL; no cross-origin hop occurs.
- Preserve the session-capability, document-key, idempotency and
  revision-CAS protections. Preserve the existing 25 MiB downloaded-byte
  limit, ZIP package validation and expanded ZIP bounds.
- Preserve path and query parameters returned by the Office server
  because the document-server's download URL can contain expiring tokens
  or cache keys; never put the full callback URL or its query parameters
  in routine application logs.

## Acceptance before merging

1. `npm run test:release-security` and `npm run test:eurooffice` pass.
   The route test uses a mocked outbound socket; the separate SSRF
   test confirms forbidden callback URL origins, literal private
   destinations and public-to-private DNS changes are refused.
2. `npm --prefix server run typecheck`, ordinary CI/CD and CodeQL pass.
3. In a test account, open an ordinary DOCX in EuroOffice, edit, force
   save and final save; reopen and verify the revision. Confirm document
   backups and recovery lists still work, including mobile.
4. Confirm callback-to-Office URL remains available from the Studio API,
   and that the *publicly resolvable* `office.openmanuscript.org`
   address is used. Local Docker/loopback server URLs cannot be
   whitelisted by this patch simply to make a test pass.
5. No Plesk user, DNS, reverse proxy or systemd changes are required.
   This PR must not be merged into automatically deployed production
   until acceptance, an independent SSH path and a VPS snapshot are
   available for rollback.

## Limitations

Same-origin validation restricts authority, not the particular Office
path. The downloaded response remains strictly validated as DOCX.
The callback capability token is still a sensitive bearer token:
use HTTPS, protect Studio logs, and do not expose callback URLs.
Provider-side webhook authentication and lifecycle authorization
should be separately assessed before a final RC1 security signoff.

Related: #765, #822, #823, #824.
