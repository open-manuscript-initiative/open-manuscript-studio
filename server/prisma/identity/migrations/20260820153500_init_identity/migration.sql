CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE "IdentityProvider" AS ENUM ('ORCID', 'OIDC', 'SAML');

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "affiliation" VARCHAR(300),
    "affiliation_ror_id" VARCHAR(128),
    "orcid" VARCHAR(19),
    "interface_language" VARCHAR(16) NOT NULL DEFAULT 'en',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_login_at" TIMESTAMPTZ(6),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_invitations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "sent_at" TIMESTAMPTZ(6),
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "issuer" VARCHAR(512) NOT NULL,
    "subject" VARCHAR(320) NOT NULL,
    "display_name" VARCHAR(200),
    "profile" JSONB,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_login_states" (
    "id" UUID NOT NULL,
    "state_hash" VARCHAR(64) NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "mode" VARCHAR(16) NOT NULL,
    "user_id" UUID,
    "invitation_token" TEXT,
    "return_path" VARCHAR(1024),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_login_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_orcid_key" ON "users"("orcid");
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");
CREATE UNIQUE INDEX "user_invitations_token_hash_key" ON "user_invitations"("token_hash");
CREATE INDEX "user_invitations_user_id_expires_at_idx" ON "user_invitations"("user_id", "expires_at");
CREATE INDEX "user_invitations_expires_at_used_at_idx" ON "user_invitations"("expires_at", "used_at");
CREATE UNIQUE INDEX "user_identities_provider_issuer_subject_key" ON "user_identities"("provider", "issuer", "subject");
CREATE INDEX "user_identities_user_id_provider_idx" ON "user_identities"("user_id", "provider");
CREATE UNIQUE INDEX "oauth_login_states_state_hash_key" ON "oauth_login_states"("state_hash");
CREATE INDEX "oauth_login_states_expires_at_idx" ON "oauth_login_states"("expires_at");

ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_login_states" ADD CONSTRAINT "oauth_login_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
