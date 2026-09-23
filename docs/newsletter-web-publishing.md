# Website publishing and review assurance

Open Manuscript Studio can deliver a committed standalone study as semantic
HTML5 to WordPress or to a provider-neutral website endpoint. This path is
usable by public-interest publishers, popular-science outlets, journals and
presses whether or not they operate OJS or OMP.

Website delivery is not itself a peer-review workflow and the target website
never becomes review authority. Publication intent and review assurance are
separate fields: a scholarly article can be explicitly unreviewed, while a
public-interest article can carry verified Studio-native review evidence.

## Visible assurance seal

Every website artifact contains both an accessible visible notice and
machine-readable metadata:

- **Not peer reviewed** — an authenticated account holder approved the exact
  artifact, but Studio has no qualifying editorial-decision evidence for that
  source revision.
- **Peer reviewed — Studio verified** — Studio verified a completed,
  Studio-native scientific review round and a separate editor acceptance
  decision bound to the exact committed revision and manuscript-state digest.

The circular mark itself is language-independent and uses one of two fixed
texts: `OMI · PEER REVIEW · VERIFIED` or
`OMI · PEER REVIEW · NOT VERIFIED`. The adjacent publication-type and evidence
explanation is localized to the manuscript language. `VERIFIED` refers only to
the workflow evidence recorded by Studio; it is not an OMI endorsement of the
article's findings or scholarly quality.

The seal reports workflow evidence; it does not certify that the findings are
true or that a particular reviewer endorsed the final wording. Reviewer names,
account IDs, e-mail addresses, confidential comments and recommendations are
never included in the HTML or the delivery payload.

The HTML metadata contract is:

```html
<meta name="omi-publication-intent" content="scholarly-article">
<meta name="omi-review-status" content="peer-reviewed">
<meta name="omi-approval-authority" content="studio-editorial-decision">
<meta name="omi-editorial-decision-id" content="…">
<meta name="omi-editorial-evidence-sha256" content="…">
```

Unreviewed artifacts omit both editorial-evidence fields and use
`not-peer-reviewed` plus `authenticated-account-holder`.

## Studio-native review authority

For organizations without OJS or OMP, Studio may own the review workflow. A
peer-reviewed web seal is available only when all of these checks pass:

1. the user has `EDITOR` access to the manuscript's review workspace;
2. every scientific assignment in the selected Studio-native review round is
   complete, has a recommendation and had a reviewer-safe manuscript snapshot;
3. the round has no OJS/OMP external installation or assignment binding;
4. the editor explicitly accepts one exact committed revision and state
   digest for publication;
5. the server recalculates the confidential evidence digest when the seal is
   selected and again before issuing a delivery grant.

Review completion is evidence, not acceptance. An editor decision is a
separate immutable record. Editing the manuscript creates a different revision
and therefore requires a new editor decision before the new artifact may carry
the reviewed seal.

When OJS or OMP owns a workflow, that external system remains authoritative.
The Studio-native decision endpoint deliberately excludes externally bound
assignments; a future connector-specific evidence adapter must map an external
decision explicitly rather than treating a completed external assignment as a
Studio decision.

The decision is recorded through the additive
`POST /api/v1/reviews/workspaces/{workspaceId}/editorial-decisions` contract;
the pre-v1 review routes are not extended with a second authority path.

## Artifact and delivery flow

Website publication is not a one-click client-side side effect.

1. Studio externalizes and checks supported assets, then creates an export
   checkpoint.
2. The HTML renderer creates a self-contained, script-free article from the
   committed head.
3. Studio inserts the selected assurance seal and metadata before hashing the
   final bytes.
4. A publication-build manifest binds the HTML digest to manuscript ID,
   revision ID, state digest, publication profile and renderer version.
5. The user reviews the final artifact in a sandboxed preview and explicitly
   approves that exact reviewed or unreviewed version.
6. `POST /api/v1/publications/web/approval-grants` validates the artifact and,
   for a reviewed seal, checks the editorial evidence. It creates a durable
   delivery record, binds it to the selected connection's exact configuration
   version and returns a short-lived, single-scope execution token.
7. `POST /api/v1/publications/web/deliveries/{id}/execute` performs the external
   write through the server-side outbox.

The idempotency identity includes the artifact build and assurance evidence,
so changing an unreviewed artifact to reviewed cannot silently reuse the
earlier delivery approval. WordPress defaults to `draft`; immediate publishing
must be selected before the final preview approval.

## Credentials and network boundary

Website credentials are personal integration credentials stored in the Studio
API database. Secrets use the existing AES-256-GCM integration secret store and
are never returned to the browser after saving.

- WordPress uses **username + application password**, never the normal account
  password.
- Generic web targets support no authentication, Bearer, `X-API-Key`, or Basic
  authentication.
- Production targets must use public HTTPS URLs. DNS and private-network SSRF
  checks run before server-side requests, and redirects are rejected.
- The connector receives the approved publication artifact and its provenance,
  not general manuscript, review or reviewer access.

## WordPress delivery

Studio uses the standard WordPress REST API. Checked PNG/JPEG/GIF/WebP images
are reconciled through `/wp-json/wp/v2/media`; the article is created or
updated through `/wp-json/wp/v2/posts`. A deterministic slug plus the stored
receipt prevents an uncertain retry from intentionally creating a second post.

WordPress receives a declared transport projection rather than the complete
standalone file: the semantic `<article>` is extracted and embedded data images
are replaced with their reconciled WordPress media URLs. The receipt therefore
records both the approved standalone-artifact digest and the exact transformed
article-fragment digest sent to WordPress. Generic receivers get the complete
HTML, so their two digests are identical.

The WordPress content contains the `<article>` including its visible assurance
notice. WordPress is only a delivery target: changing content or removing the
notice later in WordPress invalidates the Studio artifact hash and is outside
the Studio receipt's assurance.

## Generic `omi-web-publication/1` contract

The receiver gets a JSON `POST` with an `Idempotency-Key` header. A shortened
example follows; `artifact.build` is the complete publication-build manifest.

```json
{
  "protocol": "omi-web-publication/1",
  "delivery": {
    "id": "delivery-uuid",
    "idempotencyKey": "web-publication-v1:…"
  },
  "manuscript": {
    "id": "synthetic-manuscript-id",
    "revisionId": "revision-id",
    "title": "Synthetic article title"
  },
  "publication": {
    "targetStatus": "draft",
    "assurance": {
      "model": "omi-publication-assurance",
      "version": "1",
      "intent": "scholarly-article",
      "reviewStatus": "not-peer-reviewed",
      "approvalAuthority": "authenticated-account-holder",
      "disclosure": "visible-and-machine-readable"
    }
  },
  "artifact": {
    "mediaType": "text/html;charset=utf-8",
    "html": "<!doctype html>…",
    "sha256": "…",
    "build": {}
  },
  "previous": null
}
```

A successful endpoint returns HTTP 2xx and may return `externalId` and
`externalUrl` (`id` and `url` remain accepted aliases). The pre-v1 beta
`/api/publication/newsletter/publish` endpoint returns HTTP 410 so an old client
cannot fall back to client-controlled `approved: true` authority.

## Persistence and retention

The OMI manuscript remains the canonical scholarly object. Studio stores
review assignments and editor decisions as workflow state, and website IDs and
URLs as delivery receipts; none are written into portable manuscript semantics.

Pending, failed or uncertain deliveries retain the server-side outbox payload
needed for an explicit retry or reconciliation; deployments must protect that
database with their normal encryption-at-rest and backup controls. After
success Studio clears the retained HTML and title, keeping only digests, build
provenance, target-configuration version, assurance, status and the external
receipt. Audit events record
operation, scope, permissions, outcome, byte length and digest—not manuscript
content.

## 1.0 status and gates

Website delivery and the assurance seal are **Preview** for 1.0 until endpoint,
outbox/recovery, accessibility and tamper-regression tests are part of the
release evidence. A false reviewed seal, a missing unreviewed disclosure, a
reviewer-identity leak, or delivery of bytes different from the approved build
is a release blocker for every channel that exposes this feature.
