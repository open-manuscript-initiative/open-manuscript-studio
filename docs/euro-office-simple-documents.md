# Euro-Office simple documents

The Studio can optionally use a separately deployed Euro-Office Document Server for everyday Word documents. These files remain DOCX records owned by the signed-in Studio account; they are not converted to OMI manuscripts. Scholarly manuscripts continue to use the OMI document model and editor.

## Scope of this integration

- Create a blank DOCX from the author's Studio profile or upload a DOCX file.
- Store the DOCX and author attribution in the Studio database.
- Launch the Euro-Office editor inside the Studio menu.
- Give the Document Server a ten-minute, document-scoped token for file download and save callbacks. The user's Studio session cookie is never passed to Euro-Office.
- Disable comments, chat, and track-change controls for this simple-document workflow.

The first integration supports DOCX editing. ODT is not exposed as an editable upload because the current Euro-Office integration interface lists DOCX (and related Word templates) as editable formats; ODT support requires an explicit, tested conversion path.

## Server requirements

Deploy the official Euro-Office Document Server image on a host reachable from the user's browser and the Studio server. The Studio server must also be reachable from the Document Server so save callbacks can be delivered. The Euro-Office deployment documentation recommends at least 4 GB RAM and 5 GB disk space for the image. Pin a tested image version rather than using `latest` for production.

Configure these server-side environment variables on Studio:

```dotenv
EURO_OFFICE_SERVER_URL=https://office.example.org
EURO_OFFICE_JWT_SECRET=<same secret configured on Euro-Office; at least 32 characters>
FRONTEND_ORIGIN=https://studio.example.org
```

Set the same JWT secret on Euro-Office with `JWT_ENABLED=true`. Never put the secret in a `VITE_*` variable or browser code. The API refuses a partial configuration and requires HTTPS in production.

The reverse proxy and browser Content Security Policy must allow loading `web-apps/apps/api/documents/api.js` and the editor frame from the Euro-Office origin. Permit callbacks from Euro-Office to `/api/office-documents/*`; do not disable TLS certificate verification.

After configuring the server, apply the Prisma migration and rebuild the generated client:

```sh
npm --prefix server run prisma:generate
npm --prefix server run prisma:migrate:deploy
npm --prefix server run build
```

## Data and attribution

The `office_documents` table stores the original DOCX bytes, title, author name, author email, and timestamps. The owner is the authenticated Studio account. All list, open, and delete operations are scoped to that owner. The author information is also passed to Euro-Office as the editor identity. DOCX bytes are capped at 20 MB.

## Licensing and distribution

Euro-Office and its JavaScript SDK are AGPLv3. This repository's integration is an optional network integration: it loads the editor from a separately deployed Document Server and does not bundle Euro-Office source files into the Studio build. The Studio repository's MIT license file remains unchanged. The licensing effect of a particular hosted or distributed deployment still depends on how it is packaged and operated, so review the applicable AGPL obligations before release.
