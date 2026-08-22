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

CREATE TABLE "integration_translation_variants" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "manuscript_id" VARCHAR(128) NOT NULL,
  "source_locale" VARCHAR(32),
  "target_locale" VARCHAR(32) NOT NULL,
  "scope_kind" VARCHAR(64) NOT NULL,
  "scope_id" VARCHAR(256),
  "provider_id" VARCHAR(128) NOT NULL DEFAULT 'deepl',
  "translated_state" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_translation_variants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "integration_translation_variants_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "integration_translation_variants_manuscript_idx"
  ON "integration_translation_variants"("user_id", "manuscript_id", "target_locale", "updated_at" DESC);
