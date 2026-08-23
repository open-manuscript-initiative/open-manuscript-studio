CREATE TYPE "CentralAdminRole" AS ENUM ('ADMIN', 'OWNER');
CREATE TYPE "InstitutionApiCredentialStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "central_admin_grants" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "CentralAdminRole" NOT NULL DEFAULT 'ADMIN',
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "central_admin_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "central_admin_grants_user_id_key"
  ON "central_admin_grants"("user_id");
CREATE INDEX "central_admin_grants_role_idx"
  ON "central_admin_grants"("role");

ALTER TABLE "central_admin_grants"
  ADD CONSTRAINT "central_admin_grants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "institution_api_credentials" (
  "id" UUID NOT NULL,
  "institution_id" UUID NOT NULL,
  "label" VARCHAR(160) NOT NULL,
  "token_prefix" VARCHAR(24) NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "status" "InstitutionApiCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMPTZ(6),
  "last_used_at" TIMESTAMPTZ(6),
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(6),
  CONSTRAINT "institution_api_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "institution_api_credentials_token_hash_key"
  ON "institution_api_credentials"("token_hash");
CREATE INDEX "institution_api_credentials_institution_id_status_idx"
  ON "institution_api_credentials"("institution_id", "status");
CREATE INDEX "institution_api_credentials_expires_at_idx"
  ON "institution_api_credentials"("expires_at");

ALTER TABLE "institution_api_credentials"
  ADD CONSTRAINT "institution_api_credentials_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "admin_audit_events" (
  "id" UUID NOT NULL,
  "actor_user_id" UUID,
  "api_credential_id" UUID,
  "institution_id" UUID,
  "action" VARCHAR(120) NOT NULL,
  "target_type" VARCHAR(80),
  "target_id" VARCHAR(160),
  "details" JSONB,
  "ip_address" VARCHAR(64),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_events_created_at_idx"
  ON "admin_audit_events"("created_at");
CREATE INDEX "admin_audit_events_institution_id_created_at_idx"
  ON "admin_audit_events"("institution_id", "created_at");
CREATE INDEX "admin_audit_events_actor_user_id_created_at_idx"
  ON "admin_audit_events"("actor_user_id", "created_at");
