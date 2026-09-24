CREATE TABLE "personal_reference_records" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "record_id" VARCHAR(128) NOT NULL,
  "record" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "personal_reference_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "personal_reference_records_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "personal_reference_records_user_id_record_id_key"
  ON "personal_reference_records"("user_id", "record_id");

CREATE INDEX "personal_reference_records_user_id_updated_at_idx"
  ON "personal_reference_records"("user_id", "updated_at");
