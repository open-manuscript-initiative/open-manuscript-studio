CREATE TABLE "web_publication_deliveries" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "connection_id" UUID NOT NULL,
  "connection_version" TIMESTAMPTZ(6) NOT NULL,
  "manuscript_id" VARCHAR(128) NOT NULL,
  "revision_id" VARCHAR(128) NOT NULL,
  "build_id" VARCHAR(160) NOT NULL,
  "idempotency_key" VARCHAR(256) NOT NULL,
  "request_digest" VARCHAR(64) NOT NULL,
  "content_digest" VARCHAR(64) NOT NULL,
  "delivered_content_digest" VARCHAR(64),
  "title" VARCHAR(500),
  "artifact_html" TEXT,
  "artifact_build" JSONB NOT NULL,
  "intent" VARCHAR(64) NOT NULL,
  "assurance" JSONB NOT NULL,
  "target_status" VARCHAR(32) NOT NULL,
  "state" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "external_id" VARCHAR(191),
  "external_url" TEXT,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "web_publication_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "web_publication_deliveries_state_check"
    CHECK ("state" IN ('PENDING', 'IN_FLIGHT', 'SUCCEEDED', 'FAILED', 'UNKNOWN')),
  CONSTRAINT "web_publication_deliveries_target_status_check"
    CHECK ("target_status" IN ('DRAFT', 'PUBLISH')),
  CONSTRAINT "web_publication_deliveries_digest_check"
    CHECK (
      "request_digest" ~ '^[0-9a-f]{64}$'
      AND "content_digest" ~ '^[0-9a-f]{64}$'
      AND ("delivered_content_digest" IS NULL OR "delivered_content_digest" ~ '^[0-9a-f]{64}$')
    ),
  CONSTRAINT "web_publication_deliveries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "web_publication_deliveries_connection_id_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "user_integrations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "web_publication_deliveries_user_id_idempotency_key_key"
  ON "web_publication_deliveries"("user_id", "idempotency_key");
CREATE INDEX "web_publication_deliveries_connection_id_manuscript_id_idx"
  ON "web_publication_deliveries"("connection_id", "manuscript_id");
CREATE INDEX "web_publication_deliveries_state_updated_at_idx"
  ON "web_publication_deliveries"("state", "updated_at");

CREATE TABLE "web_publication_approval_grants" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "connection_id" UUID NOT NULL,
  "delivery_id" UUID NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "request_digest" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "web_publication_approval_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "web_publication_approval_grants_digest_check"
    CHECK ("token_hash" ~ '^[0-9a-f]{64}$' AND "request_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "web_publication_approval_grants_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "web_publication_approval_grants_connection_id_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "user_integrations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "web_publication_approval_grants_delivery_id_fkey"
    FOREIGN KEY ("delivery_id") REFERENCES "web_publication_deliveries"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "web_publication_approval_grants_token_hash_key"
  ON "web_publication_approval_grants"("token_hash");
CREATE INDEX "web_publication_approval_grants_user_id_expires_at_idx"
  ON "web_publication_approval_grants"("user_id", "expires_at");
CREATE INDEX "web_publication_approval_grants_delivery_id_created_at_idx"
  ON "web_publication_approval_grants"("delivery_id", "created_at");

CREATE TABLE "editorial_decisions" (
  "id" UUID NOT NULL,
  "workspace_id" VARCHAR(128) NOT NULL,
  "manuscript_id" VARCHAR(128) NOT NULL,
  "revision_id" VARCHAR(128) NOT NULL,
  "state_digest" VARCHAR(64) NOT NULL,
  "review_round" INTEGER NOT NULL,
  "decision" VARCHAR(32) NOT NULL,
  "basis_assignment_ids" JSONB NOT NULL,
  "evidence_digest" VARCHAR(64) NOT NULL,
  "decided_by_user_id" UUID NOT NULL,
  "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "editorial_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "editorial_decisions_values_check"
    CHECK (
      "decision" = 'ACCEPT'
      AND "review_round" BETWEEN 1 AND 99
      AND "state_digest" ~ '^[0-9a-f]{64}$'
      AND "evidence_digest" ~ '^[0-9a-f]{64}$'
      AND CASE
        WHEN jsonb_typeof("basis_assignment_ids") = 'array'
          THEN jsonb_array_length("basis_assignment_ids") BETWEEN 1 AND 100
        ELSE FALSE
      END
    ),
  CONSTRAINT "editorial_decisions_decided_by_user_id_fkey"
    FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "editorial_decisions_workspace_manuscript_revision_key"
  ON "editorial_decisions"("workspace_id", "manuscript_id", "revision_id");
CREATE INDEX "editorial_decisions_manuscript_revision_decision_idx"
  ON "editorial_decisions"("manuscript_id", "revision_id", "decision");
CREATE INDEX "editorial_decisions_decided_by_decided_at_idx"
  ON "editorial_decisions"("decided_by_user_id", "decided_at");
