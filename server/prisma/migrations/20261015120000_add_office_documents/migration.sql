CREATE TABLE "office_documents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(128) NOT NULL,
    "file_bytes" BYTEA NOT NULL,
    "author_name" VARCHAR(200) NOT NULL,
    "author_email" VARCHAR(320) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "office_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "office_documents_user_id_updated_at_idx"
ON "office_documents"("user_id", "updated_at");

ALTER TABLE "office_documents"
ADD CONSTRAINT "office_documents_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
