CREATE TABLE "editorial_productions" (
  "id" UUID NOT NULL PRIMARY KEY,
  "submission_id" UUID NOT NULL UNIQUE REFERENCES "native_editorial_submissions"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "state" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE TABLE "editorial_production_files" (
  "id" UUID NOT NULL PRIMARY KEY,
  "production_id" UUID NOT NULL REFERENCES "editorial_productions"("id") ON DELETE CASCADE,
  "kind" VARCHAR(16) NOT NULL CHECK ("kind" IN ('SOURCE', 'PROOF')),
  "revision_id" VARCHAR(128) NOT NULL,
  "state_digest" VARCHAR(64) NOT NULL CHECK ("state_digest" ~ '^[0-9a-f]{64}$'),
  "sha256" VARCHAR(64) NOT NULL CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  "file_name" VARCHAR(255) NOT NULL,
  "media_type" VARCHAR(128) NOT NULL,
  "build" JSONB,
  "bytes" BYTEA NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "editorial_production_files_production_id_kind_created_at_idx" ON "editorial_production_files"("production_id", "kind", "created_at");
