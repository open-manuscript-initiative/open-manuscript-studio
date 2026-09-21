# Newsletter and website publishing

Open Manuscript Studio can publish the current standalone study as semantic HTML5 to a personal WordPress site or to a generic website endpoint.

## Security model

Website credentials are personal integration credentials stored in the Studio API database. Secrets use the existing AES-256-GCM integration secret store and are never returned to the browser after saving.

- WordPress uses **username + application password**. Studio does not request or store the normal WordPress account password.
- Generic web targets support no authentication, Bearer, `X-API-Key`, or Basic authentication.
- All production targets must use public HTTPS URLs. Studio applies the same DNS/private-network SSRF restrictions used by the publishing integration layer.
- Redirects are rejected for server-side publishing requests.

Targets are configured under the user's **Integrations** profile surface.

## Two-step publication flow

Publication is intentionally not a one-click background side effect.

1. Studio renders the current manuscript with the existing semantic HTML5 publication renderer.
2. The user reviews the rendered result in a sandboxed preview.
3. The user explicitly approves the external write.
4. Studio sends the approved HTML to the selected target.

The server rejects a publication request that does not contain explicit approval.

WordPress defaults to `draft`. Publishing immediately requires selecting `publish` before generating/approving the preview.

## WordPress REST API

A WordPress target stores:

- site base URL;
- WordPress username;
- encrypted application password.

Studio publishes through the standard WordPress REST API:

- embedded PNG/JPEG/GIF/WebP data images are uploaded to `/wp-json/wp/v2/media`;
- the semantic article is sent to `/wp-json/wp/v2/posts`;
- later sends of the same OMI manuscript to the same target update the previously created WordPress post instead of creating another post.

The mapping between OMI manuscript, personal target, and external post ID is stored in `web_publications`.

## Generic website contract

A generic target receives a JSON `POST` using protocol identifier:

`omi-newsletter-publish/1`

Example payload:

```json
{
  "protocol": "omi-newsletter-publish/1",
  "manuscript": {
    "id": "manuscript-id",
    "title": "Article title"
  },
  "publication": {
    "html": "<!doctype html>...",
    "status": "draft",
    "sha256": "..."
  },
  "previous": {
    "externalId": "42",
    "externalUrl": "https://example.org/article/42"
  }
}
```

`previous` is `null` on the first send. A receiver may use it to implement idempotent update semantics.

A successful endpoint should return HTTP 2xx and may return:

```json
{
  "externalId": "42",
  "externalUrl": "https://example.org/article/42"
}
```

The aliases `id` and `url` are also accepted.

## Persistence boundary

The canonical scholarly object remains the OMI manuscript. WordPress or another website is an external publication destination, not a new source of truth. Website-specific IDs and URLs are therefore stored only as publication receipts and are not written into manuscript semantics.
