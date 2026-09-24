ALTER TABLE "native_editorial_submissions"
  ADD COLUMN "editor_user_id" UUID,
  ADD COLUMN "editor_assigned_at" TIMESTAMPTZ(6);

ALTER TABLE "native_editorial_submissions"
  ADD CONSTRAINT "native_editorial_submissions_editor_user_id_fkey"
  FOREIGN KEY ("editor_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "native_editorial_submissions_editor_user_id_status_updated_at_idx"
  ON "native_editorial_submissions"("editor_user_id", "status", "updated_at");
