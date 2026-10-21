CREATE TYPE "StudioServerDirectoryStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

CREATE TABLE "studio_server_directory_entries" (
  "id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "origin" VARCHAR(512) NOT NULL,
  "hostname" VARCHAR(253) NOT NULL,
  "status" "StudioServerDirectoryStatus" NOT NULL DEFAULT 'PENDING',
  "domain_challenge_hash" VARCHAR(64) NOT NULL,
  "heartbeat_token_hash" VARCHAR(64) NOT NULL,
  "software_version" VARCHAR(80),
  "capabilities" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "github_issue_url" TEXT,
  "verified_at" TIMESTAMPTZ(6),
  "last_heartbeat_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "studio_server_directory_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "studio_server_directory_entries_origin_key"
  ON "studio_server_directory_entries"("origin");
CREATE INDEX "studio_server_directory_entries_status_last_heartbeat_at_idx"
  ON "studio_server_directory_entries"("status", "last_heartbeat_at");
