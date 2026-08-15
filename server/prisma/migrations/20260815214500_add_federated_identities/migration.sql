-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('ORCID', 'OIDC', 'SAML');

-- CreateTable
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

-- CreateTable
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

CREATE UNIQUE INDEX "user_identities_provider_issuer_subject_key" ON "user_identities"("provider", "issuer", "subject");
CREATE INDEX "user_identities_user_id_provider_idx" ON "user_identities"("user_id", "provider");
CREATE UNIQUE INDEX "oauth_login_states_state_hash_key" ON "oauth_login_states"("state_hash");
CREATE INDEX "oauth_login_states_expires_at_idx" ON "oauth_login_states"("expires_at");

ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_login_states" ADD CONSTRAINT "oauth_login_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
