CREATE TABLE "direct_submissions" (
 "id" UUID NOT NULL, "user_id" UUID NOT NULL, "connection_id" UUID NOT NULL,
 "manuscript_id" VARCHAR(128) NOT NULL, "digest" VARCHAR(64) NOT NULL,
 "base_url" VARCHAR(2048) NOT NULL, "status" VARCHAR(32) NOT NULL DEFAULT 'NEW',
 "external_id" INTEGER, "publication_id" INTEGER,
 "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT "direct_submissions_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "direct_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "direct_submissions_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "user_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "direct_submissions_user_id_connection_id_manuscript_id_key" ON "direct_submissions"("user_id", "connection_id", "manuscript_id");
