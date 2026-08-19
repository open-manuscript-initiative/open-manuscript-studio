-- CreateTable
CREATE TABLE "integration_provider_configs" (
    "id" UUID NOT NULL,
    "provider_id" VARCHAR(128) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "authentication_mode" VARCHAR(32),
    "config" JSONB,
    "encrypted_secret" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'UNCONFIGURED',
    "last_checked_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integration_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_integrations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider_id" VARCHAR(128) NOT NULL,
    "connection_key" VARCHAR(128) NOT NULL DEFAULT 'default',
    "display_name" VARCHAR(200),
    "authentication_mode" VARCHAR(32) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "encrypted_secret" TEXT,
    "status" VARCHAR(32) NOT NULL DEFAULT 'CONFIGURED',
    "last_checked_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_provider_configs_provider_id_key"
ON "integration_provider_configs"("provider_id");

-- CreateIndex
CREATE INDEX "integration_provider_configs_enabled_status_idx"
ON "integration_provider_configs"("enabled", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_integrations_user_id_provider_id_connection_key_key"
ON "user_integrations"("user_id", "provider_id", "connection_key");

-- CreateIndex
CREATE INDEX "user_integrations_user_id_provider_id_idx"
ON "user_integrations"("user_id", "provider_id");

-- CreateIndex
CREATE INDEX "user_integrations_provider_id_enabled_status_idx"
ON "user_integrations"("provider_id", "enabled", "status");

-- AddForeignKey
ALTER TABLE "user_integrations"
ADD CONSTRAINT "user_integrations_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
