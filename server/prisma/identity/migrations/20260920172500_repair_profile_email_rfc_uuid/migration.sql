-- The original profile-email backfill used md5(...)::uuid. PostgreSQL accepts
-- every 128-bit UUID value, but the public API intentionally validates RFC-style
-- UUIDs (version nibble 1-8 and RFC variant 8/9/a/b). Repair any seeded values
-- that do not satisfy that contract. The credential FK uses ON UPDATE CASCADE,
-- so saved OJS/OMP credentials keep pointing at the same profile e-mail row.
UPDATE "user_profile_emails"
SET "id" = gen_random_uuid()
WHERE "id"::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- Future account creation must also produce an RFC-compatible UUID.
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
        gen_random_uuid(),
        NEW."id",
        lower(NEW."email"),
        true
    )
    ON CONFLICT ("user_id", "email")
    DO UPDATE SET "is_primary" = true;

    RETURN NEW;
END;
$profile_email$;
