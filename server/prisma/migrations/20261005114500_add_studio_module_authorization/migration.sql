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

CREATE TABLE "studio_module_audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "workspace_id" VARCHAR(128) NOT NULL,
    "module_id" VARCHAR(128) NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "capability" VARCHAR(128),
    "execution_grant_id" UUID,
    "details" JSONB,
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "studio_module_audit_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "studio_module_audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "studio_module_audit_events_workspace_id_created_at_idx" ON "studio_module_audit_events"("workspace_id", "created_at");
CREATE INDEX "studio_module_audit_events_module_id_created_at_idx" ON "studio_module_audit_events"("module_id", "created_at");
CREATE INDEX "studio_module_audit_events_actor_user_id_created_at_idx" ON "studio_module_audit_events"("actor_user_id", "created_at");
