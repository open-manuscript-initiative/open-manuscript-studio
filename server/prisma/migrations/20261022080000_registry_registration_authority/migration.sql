ALTER TYPE "StudioServerDirectoryStatus" ADD VALUE IF NOT EXISTS 'VERIFYING';
ALTER TABLE "studio_server_directory_entries"
  ADD COLUMN "registration_token_hash" VARCHAR(64),
  ADD COLUMN "challenge_expires_at" TIMESTAMPTZ(6);
-- Old pending requests have no private claimant proof: invalidate, require fresh registration.
UPDATE "studio_server_directory_entries" SET "status" = 'REVOKED' WHERE "status" = 'PENDING';
