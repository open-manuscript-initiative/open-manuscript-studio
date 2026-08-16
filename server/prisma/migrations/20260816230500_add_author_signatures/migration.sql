CREATE TABLE "author_signing_credentials" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "credential_id" VARCHAR(1024) NOT NULL,
  "public_key_spki" TEXT NOT NULL,
  "algorithm" VARCHAR(32) NOT NULL DEFAULT 'ES256',
  "label" VARCHAR(200),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMPTZ(6),
  CONSTRAINT "author_signing_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "author_signing_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "author_signing_credentials_credential_id_key"
  ON "author_signing_credentials"("credential_id");
CREATE INDEX "author_signing_credentials_user_id_idx"
  ON "author_signing_credentials"("user_id");

CREATE TABLE "author_signing_challenges" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "challenge_hash" VARCHAR(64) NOT NULL,
  "purpose" VARCHAR(16) NOT NULL,
  "payload_hash" VARCHAR(64),
  "payload_json" JSONB,
  "nonce" VARCHAR(128),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "author_signing_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "author_signing_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "author_signing_challenges_challenge_hash_key"
  ON "author_signing_challenges"("challenge_hash");
CREATE INDEX "author_signing_challenges_user_id_expires_at_idx"
  ON "author_signing_challenges"("user_id", "expires_at");

CREATE TABLE "publication_signature_evidence" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "signing_credential_id" UUID NOT NULL,
  "manuscript_id" VARCHAR(128) NOT NULL,
  "revision_id" VARCHAR(128) NOT NULL,
  "state_digest" VARCHAR(64) NOT NULL,
  "signer_agent_id" VARCHAR(128) NOT NULL,
  "signer_name" VARCHAR(200) NOT NULL,
  "signer_orcid" VARCHAR(19) NOT NULL,
  "identity_issuer" VARCHAR(512) NOT NULL,
  "signed_payload" JSONB NOT NULL,
  "nonce" VARCHAR(128) NOT NULL,
  "authenticator_data" TEXT NOT NULL,
  "client_data_json" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "publication_signature_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "publication_signature_evidence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "publication_signature_evidence_signing_credential_id_fkey" FOREIGN KEY ("signing_credential_id") REFERENCES "author_signing_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "publication_signature_evidence_manuscript_revision_idx"
  ON "publication_signature_evidence"("manuscript_id", "revision_id");
CREATE INDEX "publication_signature_evidence_user_id_idx"
  ON "publication_signature_evidence"("user_id");
