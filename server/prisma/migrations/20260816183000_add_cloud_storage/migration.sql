CREATE TYPE "CloudProviderType" AS ENUM ('WEBDAV', 'NEXTCLOUD');
CREATE TYPE "CloudConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');
CREATE TYPE "CloudBackupStatus" AS ENUM ('COMPLETED', 'FAILED');

CREATE TABLE "cloud_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider_type" "CloudProviderType" NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "status" "CloudConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "encrypted_credentials" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_verified_at" TIMESTAMPTZ(6),

    CONSTRAINT "cloud_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cloud_backups" (
    "id" UUID NOT NULL,
    "manuscript_id" VARCHAR(128) NOT NULL,
    "user_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "provider_object_id" TEXT NOT NULL,
    "provider_path" TEXT NOT NULL,
    "package_version" VARCHAR(32) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "status" "CloudBackupStatus" NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cloud_backups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cloud_connections_user_id_idx" ON "cloud_connections"("user_id");
CREATE INDEX "cloud_connections_provider_type_status_idx" ON "cloud_connections"("provider_type", "status");
CREATE INDEX "cloud_backups_manuscript_id_user_id_created_at_idx" ON "cloud_backups"("manuscript_id", "user_id", "created_at");
CREATE INDEX "cloud_backups_connection_id_idx" ON "cloud_backups"("connection_id");

ALTER TABLE "cloud_connections"
ADD CONSTRAINT "cloud_connections_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cloud_backups"
ADD CONSTRAINT "cloud_backups_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cloud_backups"
ADD CONSTRAINT "cloud_backups_connection_id_fkey"
FOREIGN KEY ("connection_id") REFERENCES "cloud_connections"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
