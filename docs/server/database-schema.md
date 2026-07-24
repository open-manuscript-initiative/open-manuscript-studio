Open Manuscript Studio

Database Schema

Status: Draft
Applies to: Open Manuscript Studio 0.2 and later
Database: PostgreSQL

---

1. Purpose

This document defines the initial PostgreSQL database schema for the Open Manuscript Studio backend.

The schema supports:

- local user accounts;
- server-side user profiles;
- secure authentication sessions;
- manuscript workspaces;
- workspace membership;
- role-based access control;
- workspace invitations;
- future audit logging.

Each Open Manuscript Studio installation manages its own database and users independently.

The frontend must never connect directly to PostgreSQL. All database access is performed by the backend API.

---

2. Design principles

The database schema follows these principles:

- authentication data is separated from profile data;
- passwords are stored only as secure hashes;
- session tokens are stored only as hashes;
- workspace roles are local to one installation;
- database records use UUID primary keys;
- timestamps use PostgreSQL "timestamptz";
- foreign-key constraints preserve referential integrity;
- destructive actions should be explicit;
- schema changes must be applied through migrations.

---

3. Required PostgreSQL extensions

The schema uses "gen_random_uuid()" for UUID generation.

Enable the "pgcrypto" extension:

CREATE EXTENSION IF NOT EXISTS pgcrypto;

The application database user must have permission to use the extension.

---

4. Database overview

The initial schema contains the following tables:

users
├── user_profiles
├── sessions
├── workspace_members
└── workspace_invitations

workspaces
├── workspace_members
└── workspace_invitations

Future versions may add:

manuscripts
workspace_documents
audit_events
email_verification_tokens
password_reset_tokens
passkeys
api_keys

---

5. User accounts

5.1 "users"

The "users" table stores local authentication accounts.

It must not contain public author biography data or workspace-specific roles.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  email varchar(320) NOT NULL,
  password_hash text NOT NULL,

  status varchar(32) NOT NULL DEFAULT 'active',

  email_verified_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT users_status_check
    CHECK (
      status IN (
        'pending',
        'active',
        'suspended',
        'deleted'
      )
    )
);

Fields

Field| Type| Description
"id"| "uuid"| Local user identifier
"email"| "varchar(320)"| Login and contact email address
"password_hash"| "text"| Argon2id password hash
"status"| "varchar(32)"| Account lifecycle status
"email_verified_at"| "timestamptz"| Email verification timestamp
"created_at"| "timestamptz"| Account creation time
"updated_at"| "timestamptz"| Last account update time

Email uniqueness

Email addresses must be unique without regard to letter case.

CREATE UNIQUE INDEX users_email_lower_unique
  ON users (lower(email));

This prevents the creation of separate accounts such as:

author@example.org
Author@example.org
AUTHOR@example.org

The backend should normalize email addresses before storage by:

- trimming surrounding whitespace;
- converting the domain portion to lowercase;
- rejecting invalid addresses.

The backend should not silently modify the local part beyond the normalization rules explicitly supported by the application.

---

5.2 Password storage

The "password_hash" column stores an Argon2id hash.

The database must never store:

- plaintext passwords;
- encrypted reversible passwords;
- password recovery answers;
- login form payloads;
- unhashed temporary passwords.

Password hashing must be performed by the backend before insertion or update.

Recommended algorithm:

Argon2id

The complete encoded Argon2id string should be stored because it contains:

- algorithm identifier;
- version;
- memory cost;
- iteration count;
- parallelism;
- salt;
- resulting hash.

---

6. User profiles

6.1 "user_profiles"

The "user_profiles" table stores profile information separately from authentication credentials.

CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY
    REFERENCES users(id)
    ON DELETE CASCADE,

  display_name text NOT NULL,
  affiliation text,
  orcid varchar(19),
  biography text,

  preferred_language varchar(10)
    NOT NULL DEFAULT 'en',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_profiles_orcid_format_check
    CHECK (
      orcid IS NULL
      OR orcid ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$'
    ),

  CONSTRAINT user_profiles_preferred_language_check
    CHECK (
      preferred_language ~ '^[a-z]{2}(-[A-Z]{2})?$'
    )
);

Fields

Field| Type| Description
"user_id"| "uuid"| References the owning local user
"display_name"| "text"| Name displayed in the interface
"affiliation"| "text"| Institution or organization
"orcid"| "varchar(19)"| ORCID identifier
"biography"| "text"| Optional author biography
"preferred_language"| "varchar(10)"| Preferred UI or communication language
"created_at"| "timestamptz"| Profile creation time
"updated_at"| "timestamptz"| Last profile update time

ORCID uniqueness

A verified ORCID should normally belong to only one local user.

For the alpha version, a partial unique index is recommended:

CREATE UNIQUE INDEX user_profiles_orcid_unique
  ON user_profiles (orcid)
  WHERE orcid IS NOT NULL;

This constraint may later be revised if the identity model supports shared, merged, or externally verified identities.

Profile privacy

Profile fields may later receive individual visibility settings.

Possible future values:

private
workspace
public

The initial schema does not yet implement field-level visibility.

---

7. Authentication sessions

7.1 "sessions"

The "sessions" table stores active server-side login sessions.

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  token_hash text NOT NULL,

  expires_at timestamptz NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  user_agent text,
  ip_address inet,

  revoked_at timestamptz,

  CONSTRAINT sessions_expiration_check
    CHECK (expires_at > created_at)
);

Fields

Field| Type| Description
"id"| "uuid"| Internal session identifier
"user_id"| "uuid"| Authenticated user
"token_hash"| "text"| Hash of the session token
"expires_at"| "timestamptz"| Session expiration time
"last_used_at"| "timestamptz"| Last successful use
"created_at"| "timestamptz"| Session creation time
"user_agent"| "text"| Optional browser or client information
"ip_address"| "inet"| Optional source IP address
"revoked_at"| "timestamptz"| Manual logout or revocation time

Indexes

CREATE UNIQUE INDEX sessions_token_hash_unique
  ON sessions (token_hash);

CREATE INDEX sessions_user_id_idx
  ON sessions (user_id);

CREATE INDEX sessions_expires_at_idx
  ON sessions (expires_at);

CREATE INDEX sessions_active_user_idx
  ON sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

Session-token rules

The browser receives the original random token in a cookie.

The database stores only a cryptographic hash of that token.

The cookie should use:

HttpOnly
Secure
SameSite=Lax
Path=/

The backend should reject a session when:

- the session does not exist;
- the token hash does not match;
- "expires_at" is in the past;
- "revoked_at" is not null;
- the user account is suspended or deleted.

Expired and revoked sessions should be removed periodically.

Example cleanup query:

DELETE FROM sessions
WHERE expires_at < now()
   OR revoked_at < now() - interval '30 days';

---

8. Workspaces

8.1 "workspaces"

A workspace represents the collaborative environment associated with one manuscript or publishing project.

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text NOT NULL,
  description text,

  status varchar(32) NOT NULL DEFAULT 'active',
  visibility varchar(32) NOT NULL DEFAULT 'private',

  default_language varchar(10)
    NOT NULL DEFAULT 'en',

  created_by uuid NOT NULL
    REFERENCES users(id)
    ON DELETE RESTRICT,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  archived_at timestamptz,
  deleted_at timestamptz,

  CONSTRAINT workspaces_status_check
    CHECK (
      status IN (
        'active',
        'archived',
        'deleted'
      )
    ),

  CONSTRAINT workspaces_visibility_check
    CHECK (
      visibility IN (
        'private'
      )
    ),

  CONSTRAINT workspaces_default_language_check
    CHECK (
      default_language ~ '^[a-z]{2}(-[A-Z]{2})?$'
    )
);

Fields

Field| Type| Description
"id"| "uuid"| Workspace identifier
"name"| "text"| Workspace display name
"description"| "text"| Optional workspace description
"status"| "varchar(32)"| Workspace lifecycle state
"visibility"| "varchar(32)"| Access model
"default_language"| "varchar(10)"| Default manuscript language
"created_by"| "uuid"| User who created the workspace
"created_at"| "timestamptz"| Creation time
"updated_at"| "timestamptz"| Last update time
"archived_at"| "timestamptz"| Archive time
"deleted_at"| "timestamptz"| Soft-deletion time

Indexes

CREATE INDEX workspaces_created_by_idx
  ON workspaces (created_by);

CREATE INDEX workspaces_status_idx
  ON workspaces (status);

Deletion policy

Workspace records should normally use soft deletion.

The backend should set:

status = deleted
deleted_at = current timestamp

Physical deletion should be reserved for administrative cleanup, privacy requests, or retention-policy enforcement.

---

9. Workspace membership

9.1 "workspace_members"

The "workspace_members" table connects local users to workspaces.

Roles and permissions apply only within the referenced workspace.

CREATE TABLE workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id uuid NOT NULL
    REFERENCES workspaces(id)
    ON DELETE CASCADE,

  user_id uuid NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  role varchar(32) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',

  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  removed_at timestamptz,

  CONSTRAINT workspace_members_role_check
    CHECK (
      role IN (
        'owner',
        'editor',
        'co-author',
        'reviewer',
        'translator',
        'viewer'
      )
    ),

  CONSTRAINT workspace_members_status_check
    CHECK (
      status IN (
        'invited',
        'active',
        'suspended',
        'removed'
      )
    )
);

Unique membership

A user may have only one membership record per workspace.

CREATE UNIQUE INDEX workspace_members_workspace_user_unique
  ON workspace_members (workspace_id, user_id);

Additional indexes

CREATE INDEX workspace_members_user_id_idx
  ON workspace_members (user_id);

CREATE INDEX workspace_members_workspace_id_idx
  ON workspace_members (workspace_id);

CREATE INDEX workspace_members_active_workspace_idx
  ON workspace_members (workspace_id, status)
  WHERE status = 'active';

Owner rule

Every active workspace must have at least one active owner.

This rule is difficult to enforce safely using a simple SQL constraint because it depends on multiple rows.

The backend must prevent:

- removing the final active owner;
- suspending the final active owner;
- changing the final owner's role;
- deleting the final owner's user account without transferring ownership.

Owner transfer should be executed inside one database transaction.

---

9.2 Role definitions

Owner

The owner has full control over the workspace.

Typical permissions:

- manage workspace settings;
- invite and remove members;
- change member roles;
- edit manuscript content;
- archive or delete the workspace;
- transfer ownership.

Editor

The editor manages editorial content and collaboration.

Typical permissions:

- edit manuscript content;
- manage structure and metadata;
- invite selected collaborators;
- coordinate review and translation;
- manage publishing preparation.

Co-author

The co-author contributes directly to manuscript content.

Typical permissions:

- edit assigned or shared content;
- create annotations;
- view collaboration history;
- participate in discussions.

Reviewer

The reviewer evaluates manuscript content.

Typical permissions:

- view review-assigned content;
- create review comments;
- submit a review decision;
- access only the identity data permitted by the review mode.

Translator

The translator works on translated manuscript content.

Typical permissions:

- view source content;
- edit assigned translations;
- create translation notes;
- access terminology and language metadata.

Viewer

The viewer has read-only access.

Typical permissions:

- view allowed workspace content;
- view selected comments or metadata;
- export content when explicitly permitted.

---

10. Workspace invitations

10.1 "workspace_invitations"

The "workspace_invitations" table stores pending invitations.

CREATE TABLE workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id uuid NOT NULL
    REFERENCES workspaces(id)
    ON DELETE CASCADE,

  email varchar(320) NOT NULL,

  role varchar(32) NOT NULL,

  invited_by uuid NOT NULL
    REFERENCES users(id)
    ON DELETE RESTRICT,

  token_hash text NOT NULL,

  status varchar(32) NOT NULL DEFAULT 'pending',

  expires_at timestamptz NOT NULL,

  accepted_at timestamptz,
  revoked_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT workspace_invitations_role_check
    CHECK (
      role IN (
        'editor',
        'co-author',
        'reviewer',
        'translator',
        'viewer'
      )
    ),

  CONSTRAINT workspace_invitations_status_check
    CHECK (
      status IN (
        'pending',
        'accepted',
        'expired',
        'revoked'
      )
    ),

  CONSTRAINT workspace_invitations_expiration_check
    CHECK (expires_at > created_at)
);

The "owner" role is intentionally excluded from invitations.

Ownership must be transferred through a separate authenticated operation.

Indexes

CREATE UNIQUE INDEX workspace_invitations_token_hash_unique
  ON workspace_invitations (token_hash);

CREATE INDEX workspace_invitations_workspace_id_idx
  ON workspace_invitations (workspace_id);

CREATE INDEX workspace_invitations_email_lower_idx
  ON workspace_invitations (lower(email));

CREATE INDEX workspace_invitations_pending_idx
  ON workspace_invitations (workspace_id, expires_at)
  WHERE status = 'pending';

Duplicate pending invitations

The backend should prevent multiple active invitations for the same email and role in one workspace.

A partial unique index may be used:

CREATE UNIQUE INDEX workspace_invitations_pending_unique
  ON workspace_invitations (
    workspace_id,
    lower(email),
    role
  )
  WHERE status = 'pending';

Invitation acceptance

Invitation acceptance should run inside a transaction:

1. Hash the provided invitation token.
2. Lock and retrieve the invitation.
3. Verify that the invitation is pending.
4. Verify that it has not expired.
5. Verify that the authenticated user's email matches.
6. Create or reactivate the workspace membership.
7. Mark the invitation as accepted.
8. Commit the transaction.

An invitation file or token must never grant installation-level administrator access.

---

11. Updated timestamps

PostgreSQL does not automatically update "updated_at".

The application may update it explicitly, or the database may use a trigger.

Recommended trigger function:

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

Apply the trigger to relevant tables:

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER user_profiles_set_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER workspaces_set_updated_at
BEFORE UPDATE ON workspaces
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER workspace_members_set_updated_at
BEFORE UPDATE ON workspace_members
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER workspace_invitations_set_updated_at
BEFORE UPDATE ON workspace_invitations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

---

12. Transactions

The backend must use transactions for operations that change multiple related records.

Required transactional operations include:

- registration and initial profile creation;
- workspace creation and owner-membership creation;
- invitation acceptance;
- workspace ownership transfer;
- final-owner validation;
- account deletion;
- workspace deletion;
- password reset and session revocation.

Example workspace-creation transaction:

BEGIN

Create workspace
Create owner membership
Write audit event

COMMIT

If any operation fails, all related changes must be rolled back.

---

13. Data that must not be stored

The database must not contain:

- plaintext passwords;
- reversible password encryption;
- plaintext session tokens;
- plaintext invitation tokens;
- private cryptographic keys;
- frontend environment secrets;
- PostgreSQL administrator credentials;
- unnecessary copies of manuscript content;
- authentication secrets in audit messages.

---

14. Database permissions

The application must use a dedicated PostgreSQL role.

Example:

CREATE ROLE omi_studio_app
WITH
  LOGIN
  PASSWORD 'replace-with-a-strong-password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION;

Create the database:

CREATE DATABASE omi_studio
OWNER omi_studio_app;

The application role must not be:

- a PostgreSQL superuser;
- the owner of unrelated databases;
- allowed to create other roles;
- allowed to access other applications' schemas.

A separate migration role may be introduced later for stricter production environments.

---

15. Schema migrations

All schema changes must be represented by versioned migration files.

Recommended tooling:

Drizzle ORM
Drizzle Kit

Example migration workflow:

npm run db:generate
npm run db:migrate

Production deployment must not modify tables manually unless an emergency procedure is documented.

Migration files should be committed to Git.

Database credentials and database contents must not be committed.

---

16. Backups

The PostgreSQL database must be backed up regularly.

Example custom-format backup:

pg_dump \
  --format=custom \
  --file=omi-studio-$(date +%Y-%m-%d).dump \
  omi_studio

Example restore:

pg_restore \
  --clean \
  --if-exists \
  --dbname=omi_studio \
  omi-studio-2026-07-24.dump

A complete installation backup may also need:

- uploaded manuscript assets;
- configuration files;
- environment variables;
- encryption keys;
- deployment configuration.

Backups should be:

- stored outside the application repository;
- access-controlled;
- encrypted when stored remotely;
- tested through periodic restore exercises;
- retained according to the installation's data-retention policy.

---

17. Initial complete SQL schema

The following SQL combines the initial tables, indexes, constraints, and triggers.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  email varchar(320) NOT NULL,
  password_hash text NOT NULL,

  status varchar(32) NOT NULL DEFAULT 'active',

  email_verified_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT users_status_check
    CHECK (
      status IN (
        'pending',
        'active
