CREATE TABLE "collaboration_messages" (
  "id" UUID NOT NULL,
  "document_id" VARCHAR(128) NOT NULL,
  "sender_user_id" UUID,
  "sender_name" VARCHAR(200) NOT NULL,
  "body" VARCHAR(4000) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "collaboration_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "collaboration_messages_document_id_created_at_idx"
  ON "collaboration_messages"("document_id", "created_at");

ALTER TABLE "collaboration_messages"
  ADD CONSTRAINT "collaboration_messages_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "collaborative_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collaboration_messages"
  ADD CONSTRAINT "collaboration_messages_sender_user_id_fkey"
  FOREIGN KEY ("sender_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
