# OMI Studio Integration Extension SDK v1

The Integration Extension SDK provides a small, declarative registration layer for institutional and private integrations that are not built into Open Manuscript Studio.

The registry does **not** execute arbitrary JavaScript or load remote code into Studio. An extension registers a manifest that declares its identity, compatibility version, capabilities, authentication modes, permissions, and HTTPS service endpoints. This keeps extension discovery separate from provider execution and preserves Studio's permission boundary.

## Manifest

```json
{
  "model": "omi-integration-extension",
  "apiVersion": "1",
  "id": "org.example.scholar-service",
  "name": "Example scholarly service",
  "version": "0.1.0",
  "kind": "scholarly-service",
  "description": "Institutional metadata lookup service",
  "authenticationModes": ["oauth2"],
  "permissions": ["metadata.read"],
  "capabilities": ["metadata.lookup"],
  "endpoints": {
    "lookup": "https://example.org/api/lookup"
  }
}
```

### Required fields

- `model` must be `omi-integration-extension`.
- `apiVersion` must currently be `1`. A different API version is rejected rather than silently interpreted.
- `id` is a stable lowercase identifier containing letters, numbers, dots, underscores or hyphens.
- `name` is the human-readable provider name.
- `version` is the extension implementation version.
- `kind` is one of `translation`, `ai`, `agent`, `storage`, `publishing`, `identity`, or `scholarly-service`.
- `authenticationModes` declares the authentication mechanisms supported by the provider.
- `permissions` declares the OMI data capabilities requested by the extension.
- `capabilities` declares provider-specific functions such as `metadata.lookup` or `document.translate`.

### Endpoint rules

All registered endpoints must:

1. use HTTPS;
2. contain no embedded username or password;
3. be explicitly declared in the manifest.

Registering an endpoint does not automatically grant the extension access to manuscript content. Execution must still pass through an OMI server-side adapter or another permission-aware integration implementation.

## Permissions

Built-in OMI permissions include:

- `document.read`
- `document.suggest`
- `document.write`
- `metadata.read`
- `metadata.write`
- `references.read`
- `references.write`
- `review.read`
- `files.read`
- `files.write`

External-service calls should request the smallest possible set. Agents use suggestion mode by default. A direct document or metadata write requires both the corresponding write permission and an explicit user decision.

Review-confidential content is never sent to an external provider merely because the provider has document-read access. The caller must explicitly mark the scope as confidential and explicitly permit that transmission.

## Authentication and secrets

Provider passwords are not part of an extension manifest. API keys and integration tokens are stored by the Studio API using the encrypted server-side integration secret store. The browser receives only public connection state such as whether a secret exists.

OAuth and OpenID Connect providers should authenticate on the provider's own authorization surface. Studio should receive tokens or authorization results, not provider passwords.

## Built-in execution contracts

Issue #96 introduces two reference execution paths that extension authors can model their adapters after.

### Translation

`POST /api/integrations/deepl/translate`

The request contains a declared scope and structured text segments. Studio sends only the segment text to DeepL and re-associates returned text through stable segment identifiers. Citation nodes, cross-references, code marks, equations and bibliography records are excluded from the structured translation plan.

Section and whole-manuscript translations can be stored as independent language variants through:

- `GET /api/integrations/translation-variants?manuscriptId=...`
- `POST /api/integrations/translation-variants`
- `DELETE /api/integrations/translation-variants/:variantId`

The source manuscript remains authoritative; saving a translated variant does not silently overwrite it.

### AI agents

`POST /api/integrations/agents/run`

Built-in agent identifiers are:

- `language-editor`
- `metadata-assistant`
- `summarizer`
- `citation-checker`

The server uses a provider-neutral OpenAI-compatible chat-completions adapter. The configured endpoint and model are stored as integration configuration, while the API secret remains encrypted server-side.

Agents return suggestions. The server does not mutate manuscript state as a side effect of an agent request. An explicit client-side apply action is required before suggested text becomes part of the manuscript working state.

## Audit trail

External translation and AI execution creates an audit event. The audit table records:

- user and provider identity;
- operation and declared scope;
- permissions;
- whether review-confidential data was explicitly allowed;
- whether a direct-write capability was requested;
- request and result sizes;
- SHA-256 digests of the sent and returned content;
- success/failure state and non-secret operational details.

The audit record intentionally does not store manuscript text, translated text, prompts, API keys, passwords, or provider tokens.

Audit events are available through `GET /api/integrations/audit`.

## Registry API

Authenticated Studio users can manage extension manifests through:

- `GET /api/integrations/extensions`
- `POST /api/integrations/extensions`
- `DELETE /api/integrations/extensions/:extensionId`

Registration is per Studio user in the current alpha implementation. Institutional policy and administrator-managed allow-lists can be layered on top of this registry in a later API version without changing the v1 manifest semantics.

## Compatibility principle

Extensions must declare the API version they target. Studio rejects unknown manifest API versions. This is deliberate: an extension must never gain broader permissions because a future Studio version interpreted an older manifest differently.
