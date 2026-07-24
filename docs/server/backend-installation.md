Open Manuscript Studio

Backend Installation Guide (PostgreSQL)

Status: Draft (Alpha)
Applies to: Open Manuscript Studio ≥ 0.2

---

Overview

Open Manuscript Studio is designed as a self-hosted collaborative writing platform.

Unlike the current alpha prototype, production installations store all user accounts, authentication data, workspace memberships, and collaboration metadata on the local server.

Every installation is independent.

No central authentication service is required.

---

Recommended Architecture

Browser
      │
 HTTPS
      │
React Frontend
      │
 REST API
      │
Fastify Backend
      │
Drizzle ORM
      │
PostgreSQL

The backend is responsible for:

- user authentication
- user profiles
- workspaces
- collaboration
- invitations
- permissions
- sessions
- audit logging

The frontend never communicates directly with the database.

---

Requirements

Minimum recommended environment:

- Node.js 22 LTS
- npm 10+
- PostgreSQL 16+
- HTTPS
- Linux server (Ubuntu recommended)

Recommended reverse proxy:

- Nginx
- Apache
- Plesk
- Caddy

---

Database

Open Manuscript Studio uses PostgreSQL as its primary database.

Reasons:

- reliable concurrent access
- transactional consistency
- strong indexing
- excellent scalability
- mature backup tools
- future clustering support

SQLite is suitable for development only.

---

Database User

Create a dedicated PostgreSQL user.

Example:

CREATE USER omi_studio_app
WITH PASSWORD 'strong-password';

CREATE DATABASE omi_studio
OWNER omi_studio_app;

The application must never use the PostgreSQL administrator account.

---

Environment Variables

Example ".env"

DATABASE_URL=postgresql://omi_studio_app:password@127.0.0.1:5432/omi_studio

SESSION_SECRET=<generate-a-long-random-secret>

NODE_ENV=production

PORT=3000

Do not commit ".env" to Git.

---

Password Storage

Passwords are never encrypted.

Passwords are stored using:

- Argon2id

Only password hashes are stored.

Plain-text passwords are never written to the database.

---

Sessions

Authentication uses secure server-side sessions.

Session cookies should be:

- HttpOnly
- Secure
- SameSite=Lax

Session tokens stored in the database must be hashed.

---

User Accounts

Each installation manages its own users.

A user account contains:

- email address
- password hash
- account status
- timestamps

User accounts are local to the installation.

---

User Profiles

Profiles are stored separately from authentication.

Typical profile fields include:

- display name
- ORCID
- affiliation
- biography
- preferred language

This separation allows future profile portability without affecting authentication.

---

Workspace Permissions

Workspace membership is always local.

Roles include:

- Owner
- Editor
- Co-author
- Reviewer
- Translator
- Viewer

Permissions are managed independently by each installation.

---

Security Recommendations

Always use:

- HTTPS
- automatic security updates
- regular PostgreSQL backups
- least-privilege database user
- strong passwords
- firewall protection

Recommended:

- fail2ban
- automatic backup verification
- encrypted backup storage

---

Backup Strategy

Back up:

- PostgreSQL database
- uploaded files
- configuration
- environment variables

Recommended tool:

pg_dump

---

Deployment

Typical deployment:

Git Repository
        │
        ▼
Git Pull
        │
npm install
        │
npm run build
        │
Database migrations
        │
Restart backend
        │
Frontend served by web server

---

Future Extensions

The architecture has been designed to support future features without major redesign.

Planned capabilities include:

- OAuth2
- OpenID Connect
- ORCID authentication
- Passkeys (WebAuthn)
- Two-factor authentication
- Multi-server federation
- Portable author profiles
- External identity providers

---

Design Principles

Open Manuscript Studio follows these principles:

- local ownership of data
- self-hosting by default
- no mandatory cloud services
- open standards
- portable manuscripts
- secure authentication
- independent installations

These principles are aligned with the goals of the Open Manuscript Initiative.
