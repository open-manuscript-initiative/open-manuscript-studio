CREATE TABLE "collaborative_document_states" (
    "document_id" VARCHAR(128) NOT NULL,
    "state" BYTEA NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "collaborative_document_states_pkey" PRIMARY KEY ("document_id")
);

CREATE TABLE "collaboration_connection_tickets" (
    "id" UUID NOT NULL,
    "document_id" VARCHAR(128) NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collaboration_connection_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collaboration_connection_tickets_token_hash_key" ON "collaboration_connection_tickets"("token_hash");
CREATE INDEX "collaboration_connection_tickets_document_id_expires_at_idx" ON "collaboration_connection_tickets"("document_id", "expires_at");
CREATE INDEX "collaboration_connection_tickets_user_id_expires_at_idx" ON "collaboration_connection_tickets"("user_id", "expires_at");

ALTER TABLE "collaborative_document_states" ADD CONSTRAINT "collaborative_document_states_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "collaborative_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_connection_tickets" ADD CONSTRAINT "collaboration_connection_tickets_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "collaborative_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_connection_tickets" ADD CONSTRAINT "collaboration_connection_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
