CREATE TABLE "web_publications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "connection_id" UUID NOT NULL,
  "manuscript_id" VARCHAR(128) NOT NULL,
  "external_id" VARCHAR(191),
  "external_url" TEXT,
  "content_digest" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "web_publications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "web_publications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "web_publications_connection_id_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "user_integrations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "web_publications_user_id_connection_id_manuscript_id_key"
  ON "web_publications"("user_id", "connection_id", "manuscript_id");
CREATE INDEX "web_publications_connection_id_idx"
  ON "web_publications"("connection_id");
CREATE INDEX "web_publications_user_id_updated_at_idx"
  ON "web_publications"("user_id", "updated_at");
