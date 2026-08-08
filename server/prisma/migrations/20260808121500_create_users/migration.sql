-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ExternalPlatform" AS ENUM ('OJS', 'OMP');

-- CreateEnum
CREATE TYPE "ExternalInstallationStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "affiliation" VARCHAR(300),
    "affiliation_ror_id" VARCHAR(128),
    "orcid" VARCHAR(19),
    "interface_language" VARCHAR(16) NOT NULL DEFAULT 'en',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "last_login_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_orcid_key" ON "users"("orcid");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "external_installations_installation_id_key" ON "external_installations"("installation_id");

-- CreateIndex
CREATE INDEX "external_installations_platform_status_idx" ON "external_installations"("platform", "status");

-- CreateIndex
CREATE UNIQUE INDEX "external_launch_nonces_installation_id_nonce_key" ON "external_launch_nonces"("installation_id", "nonce");

-- CreateIndex
CREATE INDEX "external_launch_nonces_expires_at_idx" ON "external_launch_nonces"("expires_at");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
