CREATE TABLE "integration_audit_events" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "provider_id" VARCHAR(128) NOT NULL,
  "operation" VARCHAR(128) NOT NULL,
  "scope_kind" VARCHAR(64) NOT NULL,
  "scope_id" VARCHAR(256),
  "input_digest" VARCHAR(64),
  "input_length" INTEGER,
  "output_digest" VARCHAR(64),
  "output_length" INTEGER,
  "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "review_confidential" BOOLEAN NOT NULL DEFAULT FALSE,
  "direct_write" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" VARCHAR(32) NOT NULL,
  "detail" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_audit_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "integration_audit_events_user_created_at_idx"
  ON "integration_audit_events"("user_id", "created_at" DESC);
CREATE INDEX "integration_audit_events_provider_created_at_idx"
  ON "integration_audit_events"("provider_id", "created_at" DESC);

CREATE TABLE "integration_extension_manifests" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "extension_id" VARCHAR(128) NOT NULL,
  "manifest" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_extension_manifests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_extension_manifests_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "integration_extension_manifests_user_extension_key"
  ON "integration_extension_manifests"("user_id", "extension_id");
