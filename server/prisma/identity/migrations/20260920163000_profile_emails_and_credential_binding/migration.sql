CREATE TABLE "user_profile_emails" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_profile_emails_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_profile_emails_user_id_email_key"
    ON "user_profile_emails"("user_id", "email");

CREATE INDEX "user_profile_emails_user_id_is_primary_idx"
    ON "user_profile_emails"("user_id", "is_primary");

ALTER TABLE "user_profile_emails"
    ADD CONSTRAINT "user_profile_emails_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the account login address as the primary personal-profile address.
INSERT INTO "user_profile_emails" (
    "id",
    "user_id",
    "email",
    "is_primary"
)
SELECT
    md5("id"::text || ':profile-email:' || lower("email"))::uuid,
    "id",
    lower("email"),
    true
FROM "users"
ON CONFLICT ("user_id", "email") DO NOTHING;

-- Keep future account creation consistent regardless of whether it comes from
-- password registration, ORCID, OIDC, invitation acceptance or legacy import.
CREATE OR REPLACE FUNCTION "create_primary_user_profile_email"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $profile_email$
BEGIN
    INSERT INTO "user_profile_emails" (
        "id",
        "user_id",
        "email",
        "is_primary"
    )
    VALUES (
        md5(NEW."id"::text || ':profile-email:' || lower(NEW."email"))::uuid,
        NEW."id",
        lower(NEW."email"),
        true
    )
    ON CONFLICT ("user_id", "email")
    DO UPDATE SET "is_primary" = true;

    RETURN NEW;
END;
$profile_email$;

CREATE TRIGGER "users_create_primary_profile_email"
AFTER INSERT ON "users"
FOR EACH ROW
EXECUTE FUNCTION "create_primary_user_profile_email"();

ALTER TABLE "personal_publishing_credentials"
    ADD COLUMN "profile_email_id" UUID;

-- Existing credentials are associated with the account's primary address.
UPDATE "personal_publishing_credentials" AS credential
SET "profile_email_id" = profile_email."id"
FROM "user_profile_emails" AS profile_email
WHERE
    profile_email."user_id" = credential."user_id"
    AND profile_email."is_primary" = true;

ALTER TABLE "personal_publishing_credentials"
    ALTER COLUMN "profile_email_id" SET NOT NULL;

DROP INDEX "personal_publishing_credentials_user_id_provider_base_url_key";

CREATE UNIQUE INDEX "personal_publishing_credentials_user_id_provider_base_url_profile_email_id_key"
    ON "personal_publishing_credentials"("user_id", "provider", "base_url", "profile_email_id");

CREATE INDEX "personal_publishing_credentials_user_id_provider_base_url_idx"
    ON "personal_publishing_credentials"("user_id", "provider", "base_url");

CREATE INDEX "personal_publishing_credentials_profile_email_id_idx"
    ON "personal_publishing_credentials"("profile_email_id");

ALTER TABLE "personal_publishing_credentials"
    ADD CONSTRAINT "personal_publishing_credentials_profile_email_id_fkey"
    FOREIGN KEY ("profile_email_id") REFERENCES "user_profile_emails"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
