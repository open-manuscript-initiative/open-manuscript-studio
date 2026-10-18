ALTER TABLE "eurooffice_sessions" ADD COLUMN "base_revision" INTEGER NOT NULL DEFAULT 1;
-- Existing sessions lack revision binding: require a fresh editor launch.
UPDATE "eurooffice_sessions" SET "expires_at" = LEAST("expires_at", CURRENT_TIMESTAMP);
ALTER TABLE "eurooffice_sessions" ALTER COLUMN "base_revision" DROP DEFAULT;
CREATE TABLE "eurooffice_saves" (
 "id" UUID NOT NULL PRIMARY KEY, "document_id" UUID NOT NULL, "document_key" VARCHAR(128) NOT NULL,
 "callback_digest" VARCHAR(64) NOT NULL, "content_hash" VARCHAR(64) NOT NULL, "content" BYTEA NOT NULL,
 "status" INTEGER NOT NULL, "applied" BOOLEAN NOT NULL DEFAULT false,
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "eurooffice_saves_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "plain_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "eurooffice_saves_document_id_callback_digest_key" ON "eurooffice_saves"("document_id", "callback_digest");
CREATE INDEX "eurooffice_saves_document_id_created_at_idx" ON "eurooffice_saves"("document_id", "created_at");
CREATE TABLE "recognition_executions" (
 "id" UUID NOT NULL PRIMARY KEY, "user_id" UUID NOT NULL, "workspace_id" VARCHAR(128) NOT NULL,
 "request_key" VARCHAR(64) NOT NULL, "connection_id" UUID NOT NULL, "provider_origin" VARCHAR(256) NOT NULL,
 "model_id" INTEGER NOT NULL, "image_digest" VARCHAR(64) NOT NULL, "grant_id" UUID NOT NULL,
 "purpose" VARCHAR(32) NOT NULL DEFAULT 'transcription', "data_scope" VARCHAR(32) NOT NULL DEFAULT 'uploaded-image',
 "expires_at" TIMESTAMPTZ(6) NOT NULL, "status" VARCHAR(32) NOT NULL, "process_id" INTEGER,
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT "recognition_executions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "recognition_executions_user_id_workspace_id_request_key_key" ON "recognition_executions"("user_id", "workspace_id", "request_key");
CREATE INDEX "recognition_executions_user_id_workspace_id_created_at_idx" ON "recognition_executions"("user_id", "workspace_id", "created_at");
