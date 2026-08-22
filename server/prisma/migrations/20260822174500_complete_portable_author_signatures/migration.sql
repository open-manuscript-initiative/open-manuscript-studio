CREATE TABLE "signature_issuer_keys" (
  "id" UUID NOT NULL,
  "issuer" VARCHAR(512) NOT NULL,
  "key_id" VARCHAR(128) NOT NULL,
  "public_key_spki" TEXT NOT NULL,
  "encrypted_private_key" TEXT NOT NULL,
  "algorithm" VARCHAR(32) NOT NULL DEFAULT 'Ed25519',
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "signature_issuer_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "signature_issuer_keys_key_id_key"
  ON "signature_issuer_keys"("key_id");
CREATE INDEX "signature_issuer_keys_active_created_at_idx"
  ON "signature_issuer_keys"("active", "created_at");

CREATE TABLE "publication_revision_commits" (
  "id" UUID NOT NULL,
  "manuscript_id" VARCHAR(128) NOT NULL,
  "revision_id" VARCHAR(128) NOT NULL,
  "state_digest" VARCHAR(64) NOT NULL,
  "snapshot_state" JSONB NOT NULL,
  "snapshot_created_at" TIMESTAMPTZ(6) NOT NULL,
  "committed_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "publication_revision_commits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "publication_revision_commits_committed_by_user_id_fkey"
    FOREIGN KEY ("committed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "publication_revision_commits_manuscript_revision_key"
  ON "publication_revision_commits"("manuscript_id", "revision_id");
CREATE INDEX "publication_revision_commits_digest_idx"
  ON "publication_revision_commits"("state_digest");

ALTER TABLE "author_signing_credentials"
  ADD COLUMN "issuer_attestation" JSONB;

ALTER TABLE "publication_signature_evidence"
  ADD COLUMN "credential_attestation" JSONB;
