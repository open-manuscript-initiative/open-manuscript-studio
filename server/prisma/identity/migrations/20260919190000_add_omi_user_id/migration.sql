ALTER TABLE "users"
ADD COLUMN "omi_user_id" UUID;

CREATE UNIQUE INDEX "users_omi_user_id_key"
ON "users"("omi_user_id");
