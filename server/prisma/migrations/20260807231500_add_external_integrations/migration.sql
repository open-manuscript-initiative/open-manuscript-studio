-- CreateEnum
CREATE TYPE "ExternalPlatform" AS ENUM ('OJS', 'OMP');

-- CreateEnum
CREATE TYPE "ExternalInstallationStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "external_installations" (
    "id" UUID NOT NULL,
    "installation_id" VARCHAR(128) NOT NULL,
    "platform" "ExternalPlatform" NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "base_url" VARCHAR(2048) NOT NULL,
    "shared_secret_ciphertext" TEXT NOT NULL,
    "shared_secret_iv" VARCHAR(128) NOT NULL,
    "shared_secret_auth_tag" VARCHAR(128) NOT NULL,
    "status" "ExternalInstallationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "external_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_launch_nonces" (
    "id" UUID NOT NULL,
    "installation_id" VARCHAR(128) NOT NULL,
    "nonce" VARCHAR(256) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_launch_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_installations_installation_id_key"
ON "external_installations"("installation_id");

-- CreateIndex
CREATE INDEX "external_installations_platform_status_idx"
ON "external_installations"("platform", "status");

-- CreateIndex
CREATE UNIQUE INDEX "external_launch_nonces_installation_id_nonce_key"
ON "external_launch_nonces"("installation_id", "nonce");

-- CreateIndex
CREATE INDEX "external_launch_nonces_expires_at_idx"
ON "external_launch_nonces"("expires_at");
