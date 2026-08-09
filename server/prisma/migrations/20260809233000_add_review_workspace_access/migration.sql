-- CreateEnum
CREATE TYPE "ReviewWorkspaceRole" AS ENUM ('AUTHOR', 'EDITOR');

-- CreateTable
CREATE TABLE "review_workspace_access" (
    "id" UUID NOT NULL,
    "workspace_id" VARCHAR(128) NOT NULL,
    "manuscript_id" VARCHAR(128) NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ReviewWorkspaceRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "review_workspace_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_workspace_access_workspace_id_user_id_role_key"
ON "review_workspace_access"("workspace_id", "user_id", "role");

-- CreateIndex
CREATE INDEX "review_workspace_access_user_id_role_idx"
ON "review_workspace_access"("user_id", "role");

-- CreateIndex
CREATE INDEX "review_workspace_access_workspace_id_role_idx"
ON "review_workspace_access"("workspace_id", "role");

-- AddForeignKey
ALTER TABLE "review_workspace_access"
ADD CONSTRAINT "review_workspace_access_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
