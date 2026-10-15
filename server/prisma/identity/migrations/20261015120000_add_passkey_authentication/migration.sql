CREATE TYPE "PasskeyChallengePurpose" AS ENUM ('REGISTRATION', 'AUTHENTICATION');

CREATE TABLE "user_passkeys" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "credential_id" VARCHAR(1024) NOT NULL,
  "public_key" BYTEA NOT NULL,
  "counter" BIGINT NOT NULL DEFAULT 0,
  "transports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "device_type" VARCHAR(32) NOT NULL,
  "backed_up" BOOLEAN NOT NULL DEFAULT false,
  "label" VARCHAR(100) NOT NULL DEFAULT 'Passkey',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMPTZ(6),
  CONSTRAINT "user_passkeys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "passkey_challenges" (
  "id" UUID NOT NULL,
  "challenge" VARCHAR(128) NOT NULL,
  "user_id" UUID,
  "purpose" "PasskeyChallengePurpose" NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "passkey_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_passkeys_credential_id_key" ON "user_passkeys"("credential_id");
CREATE INDEX "user_passkeys_user_id_created_at_idx" ON "user_passkeys"("user_id", "created_at");
CREATE UNIQUE INDEX "passkey_challenges_challenge_key" ON "passkey_challenges"("challenge");
CREATE INDEX "passkey_challenges_expires_at_idx" ON "passkey_challenges"("expires_at");
CREATE INDEX "passkey_challenges_user_id_purpose_expires_at_idx" ON "passkey_challenges"("user_id", "purpose", "expires_at");

ALTER TABLE "user_passkeys" ADD CONSTRAINT "user_passkeys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "passkey_challenges" ADD CONSTRAINT "passkey_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
