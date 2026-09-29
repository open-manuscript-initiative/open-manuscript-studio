ALTER TABLE "cloud_backups"
ADD COLUMN "title" VARCHAR(300) NOT NULL DEFAULT '',
ADD COLUMN "location_url" TEXT;

CREATE INDEX "cloud_backups_user_id_created_at_idx"
ON "cloud_backups"("user_id", "created_at");
