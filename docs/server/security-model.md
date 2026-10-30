Open Manuscript Studio — Backend Security Model (Short)

Status: Draft
Applies to: v0.2+
Scope: Auth, sessions, profiles, workspaces, invitations

---

Purpose

Defines backend security for local, self-hosted installations. Protects accounts, sessions, workspaces, invitations, and future content. No central auth.

---

Goals

- Secure password storage (Argon2id)
- Server-side sessions
- Auth + workspace-level authorization
- Protection against brute force, CSRF, session theft, enumeration
- Safe invitations and reviewer anonymity
- Auditable actions and secure defaults

---

Architecture

Browser → HTTPS → Proxy → Backend → PostgreSQL
All requests untrusted; backend enforces all permissions.

---

Passwords

- Hash with Argon2id (no plaintext or reversible storage)
- Prefer long passwords (≥12 chars)
- Reject common/compromised passwords
- HTTPS only; never in URLs or logs

---

Sessions

- Opaque tokens; store only hashed token
- Secure cookie: HttpOnly, Secure, SameSite=Lax
- Idle: 24h, Absolute: 30d
- Rotate on login, password change, privilege changes
- Validate on every request

---

CSRF & CORS

- Secure, HttpOnly, SameSite=Lax cookies; reject unsafe cookie-authenticated requests unless Origin exactly matches a configured browser/Tauri origin
- Native clients use bearer credentials; one-time HMAC-signed PKP review launches explicitly retain their own session + signed-assertion checks
- CORS: allow only configured origins. CORS alone is not a CSRF defence against HTML forms or same-site subdomains
- Future browser form endpoints must retain the Origin gate or add equivalent per-session CSRF token validation

---

Auth Endpoints

- Register, login, logout, change password, session revoke
- Generic login errors (no account enumeration)
- Rate limit auth endpoints

---

Authorization

- Separate auth vs authorization
- Workspace-based roles and permissions
- Default deny
- Always check object-level access

---

Roles & Permissions

Roles: owner, editor, co-author, reviewer, translator, viewer
Use permission checks (not role checks)

---

Reviewer Anonymity

Enforced server-side; no identity leaks via API, metadata, or exports.

---

Invitations

- Random, single-use, time-limited tokens (hashed)
- Bound to email, role, workspace
- Default expiry: 7 days

---

Input & Injection

- Validate all inputs server-side
- Use parameterized queries (no string SQL)

---

XSS

- Treat all user content as untrusted
- Sanitize HTML if used

---

Security Headers & HTTPS

- HSTS, CSP, etc.
- HTTPS required; redirect HTTP

---

Secrets

- Never commit to Git
- Use ".env", restrict permissions

---

Database

- Dedicated role, least privilege
- Prefer local access only

---

Logging & Auditing

- No secrets in logs
- Record key security events

---

Errors

- No internal details exposed
- Use generic responses

---

File Uploads

- Validate type/size
- Store safely outside public paths

---

Dependencies

- Keep minimal, updated, audited

---

Account States

pending, active, suspended, deleted

---

Password Reset & Email Verification

- Token-based, single-use, time-limited
- Revoke sessions after reset

---

Admin Security

- Separate from workspace roles
- Require audit logging and recent auth
- Automatic central/institutional owner provisioning requires a configured allow-listed Studio email **and** a linked OIDC/SAML identity whose trusted provider explicitly verified the same email. Linking any unrelated SSO account must not grant administrator rights.
- Microsoft preferred_username alone is not proof that an email address is verified. Admin bootstrap must fail closed when the provider omits verification evidence; use a trusted configured institutional IdP that supplies verified email claims for bootstrap.
- Existing grants are not silently revoked by the new provisioning rule; administrators should audit previously issued owner grants and linked identities.

---

Backups

- Encrypted, restricted, tested
- Not publicly accessible

---

Deployment

- Use locked dependencies
- Protect secrets and data
- Verify HTTPS and cookies

---

Testing

Include auth, sessions, CSRF, authorization, rate limits, XSS, SQL injection.

---

Incident Response

Revoke sessions, rotate secrets, patch, audit, notify users.

---

Key Invariants

- Passwords never recoverable
- Tokens stored hashed
- Backend enforces all permissions
- Reviewer anonymity preserved
- Secrets never in Git

---

Summary

Security is based on:
Argon2id, server-side sessions, secure cookies, PostgreSQL, permission-based access, strict validation, and strong isolation per installation.
