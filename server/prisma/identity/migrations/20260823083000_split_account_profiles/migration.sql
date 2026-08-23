-- Separate personal account metadata from reusable institution-specific profiles
-- and add server-authoritative organization roles.
ALTER TABLE "users"
  ADD COLUMN "bio" VARCHAR(2000),
  ADD COLUMN "time_zone" VARCHAR(64);

CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "InstitutionRole" AS ENUM ('MEMBER', 'ADMIN', 'OWNER');

CREATE TABLE "institutions" (
  "id" UUID NOT NULL,
  "name" VARCHAR(300) NOT NULL,
  "ror_id" VARCHAR(128),
  "status" "InstitutionStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "institutions_ror_id_key" ON "institutions"("ror_id");
CREATE INDEX "institutions_name_idx" ON "institutions"("name");

CREATE TABLE "institution_memberships" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "institution_id" UUID NOT NULL,
  "role" "InstitutionRole" NOT NULL DEFAULT 'MEMBER',
  "department" VARCHAR(300),
  "position_title" VARCHAR(200),
  "institutional_email" VARCHAR(320),
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "identity_id" UUID,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "institution_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "institution_memberships_user_id_institution_id_key"
  ON "institution_memberships"("user_id", "institution_id");
CREATE INDEX "institution_memberships_user_id_is_default_idx"
  ON "institution_memberships"("user_id", "is_default");
CREATE INDEX "institution_memberships_institution_id_role_idx"
  ON "institution_memberships"("institution_id", "role");
CREATE INDEX "institution_memberships_identity_id_idx"
  ON "institution_memberships"("identity_id");

ALTER TABLE "institution_memberships"
  ADD CONSTRAINT "institution_memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "institution_memberships"
  ADD CONSTRAINT "institution_memberships_institution_id_fkey"
  FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "institution_memberships"
  ADD CONSTRAINT "institution_memberships_identity_id_fkey"
  FOREIGN KEY ("identity_id") REFERENCES "user_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
