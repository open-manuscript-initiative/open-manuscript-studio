-- Explicit double-opt-in for the CENTRAL Open Manuscript Studio Android closed test.
-- Records are not Studio accounts and do not confer Google Play access.
CREATE TABLE IF NOT EXISTS "android_closed_test_signups" (
  "email" VARCHAR(320) PRIMARY KEY,
  "confirm_token_hash" VARCHAR(64) NOT NULL UNIQUE,
  "cancel_token_hash" VARCHAR(64) NOT NULL UNIQUE,
  "confirm_expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "verified_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "android_closed_test_signups_verified_at_idx"
  ON "android_closed_test_signups" ("verified_at");
