CREATE TABLE "studio_module_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "workspace_id" VARCHAR(128) NOT NULL,
    "active_module_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "studio_module_preferences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "studio_module_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "studio_module_preferences_user_id_workspace_id_key" ON "studio_module_preferences"("user_id", "workspace_id");
CREATE INDEX "studio_module_preferences_workspace_id_idx" ON "studio_module_preferences"("workspace_id");
