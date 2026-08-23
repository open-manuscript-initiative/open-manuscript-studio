-- Separate personal account metadata from reusable institution-specific profiles.
ALTER TABLE "users"
  ADD COLUMN "bio" VARCHAR(2000),
  ADD COLUMN "time_zone" VARCHAR(64);

CREATE TABLE "institutional_profiles" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "organization_name" VARCHAR(300) NOT NULL,
  "ror_id" VARCHAR(128),
  "department" VARCHAR(300),
  "position_title" VARCHAR(200),
  "institutional_email" VARCHAR(320),
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "identity_id" UUID,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "institutional_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "institutional_profiles_user_id_is_default_idx"
  ON "institutional_profiles"("user_id", "is_default");
CREATE INDEX "institutional_profiles_user_id_ror_id_idx"
  ON "institutional_profiles"("user_id", "ror_id");
CREATE INDEX "institutional_profiles_identity_id_idx"
  ON "institutional_profiles"("identity_id");

ALTER TABLE "institutional_profiles"
  ADD CONSTRAINT "institutional_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "institutional_profiles"
  ADD CONSTRAINT "institutional_profiles_identity_id_fkey"
  FOREIGN KEY ("identity_id") REFERENCES "user_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
