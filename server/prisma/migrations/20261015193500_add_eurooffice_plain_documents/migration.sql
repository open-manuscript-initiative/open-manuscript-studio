CREATE TABLE "plain_documents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "content" BYTEA NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plain_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "eurooffice_sessions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "document_key" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eurooffice_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "eurooffice_sessions_token_hash_key" ON "eurooffice_sessions"("token_hash");
CREATE INDEX "plain_documents_user_id_updated_at_idx" ON "plain_documents"("user_id", "updated_at");
CREATE INDEX "eurooffice_sessions_document_id_expires_at_idx" ON "eurooffice_sessions"("document_id", "expires_at");
CREATE INDEX "eurooffice_sessions_user_id_expires_at_idx" ON "eurooffice_sessions"("user_id", "expires_at");

ALTER TABLE "plain_documents" ADD CONSTRAINT "plain_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eurooffice_sessions" ADD CONSTRAINT "eurooffice_sessions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "plain_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "eurooffice_sessions" ADD CONSTRAINT "eurooffice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
