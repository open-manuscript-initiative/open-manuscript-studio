CREATE TABLE "personal_publishing_credentials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "PublicationVenueIntegrationProvider" NOT NULL,
    "label" VARCHAR(200),
    "base_url" VARCHAR(2048) NOT NULL,
    "api_key_ciphertext" TEXT NOT NULL,
    "api_key_iv" VARCHAR(64) NOT NULL,
    "api_key_auth_tag" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "personal_publishing_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "personal_publishing_credentials_user_id_provider_base_url_key"
    ON "personal_publishing_credentials"("user_id", "provider", "base_url");

CREATE INDEX "personal_publishing_credentials_user_id_provider_idx"
    ON "personal_publishing_credentials"("user_id", "provider");

ALTER TABLE "personal_publishing_credentials"
    ADD CONSTRAINT "personal_publishing_credentials_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the existing one-per-platform personal credentials before removing
-- the legacy columns. The deterministic UUID is used only for migrated rows.
INSERT INTO "personal_publishing_credentials" (
    "id",
    "user_id",
    "provider",
    "base_url",
    "api_key_ciphertext",
    "api_key_iv",
    "api_key_auth_tag"
)
SELECT
    md5("id"::text || ':OJS:' || "ojs_api_base_url")::uuid,
    "id",
    'OJS'::"PublicationVenueIntegrationProvider",
    "ojs_api_base_url",
    "ojs_api_key_ciphertext",
    "ojs_api_key_iv",
    "ojs_api_key_auth_tag"
FROM "users"
WHERE
    "ojs_api_base_url" IS NOT NULL
    AND "ojs_api_key_ciphertext" IS NOT NULL
    AND "ojs_api_key_iv" IS NOT NULL
    AND "ojs_api_key_auth_tag" IS NOT NULL
ON CONFLICT ("user_id", "provider", "base_url") DO NOTHING;

INSERT INTO "personal_publishing_credentials" (
    "id",
    "user_id",
    "provider",
    "base_url",
    "api_key_ciphertext",
    "api_key_iv",
    "api_key_auth_tag"
)
SELECT
    md5("id"::text || ':OMP:' || "omp_api_base_url")::uuid,
    "id",
    'OMP'::"PublicationVenueIntegrationProvider",
    "omp_api_base_url",
    "omp_api_key_ciphertext",
    "omp_api_key_iv",
    "omp_api_key_auth_tag"
FROM "users"
WHERE
    "omp_api_base_url" IS NOT NULL
    AND "omp_api_key_ciphertext" IS NOT NULL
    AND "omp_api_key_iv" IS NOT NULL
    AND "omp_api_key_auth_tag" IS NOT NULL
ON CONFLICT ("user_id", "provider", "base_url") DO NOTHING;

ALTER TABLE "users"
    DROP COLUMN "ojs_api_key_ciphertext",
    DROP COLUMN "ojs_api_key_iv",
    DROP COLUMN "ojs_api_key_auth_tag",
    DROP COLUMN "ojs_api_base_url",
    DROP COLUMN "omp_api_key_ciphertext",
    DROP COLUMN "omp_api_key_iv",
    DROP COLUMN "omp_api_key_auth_tag",
    DROP COLUMN "omp_api_base_url";
