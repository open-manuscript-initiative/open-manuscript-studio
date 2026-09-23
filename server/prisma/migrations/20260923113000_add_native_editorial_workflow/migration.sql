CREATE TYPE "NativeSubmissionStatus" AS ENUM (
  'SUBMITTED',
  'EDITOR_ASSIGNED',
  'UNDER_REVIEW',
  'REVISION_REQUESTED',
  'REVISION_SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'PUBLISHED'
);

CREATE TABLE "native_submissions" (
  "id" UUID NOT NULL,
  "publication_venue_id" UUID NOT NULL,
  "workspace_id" VARCHAR(128) NOT NULL,
  "manuscript_id" VARCHAR(128) NOT NULL,
  "author_user_id" UUID NOT NULL,
  "editor_user_id" UUID,
  "title" VARCHAR(500) NOT NULL,
  "revision_id" VARCHAR(128) NOT NULL,
  "state_digest" VARCHAR(64) NOT NULL,
  "manuscript_snapshot" JSONB NOT NULL,
  "review_round" INTEGER NOT NULL DEFAULT 1,
  "status" "NativeSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "latest_editorial_note" TEXT,
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "editor_assigned_at" TIMESTAMPTZ(6),
  "revision_requested_at" TIMESTAMPTZ(6),
  "revision_submitted_at" TIMESTAMPTZ(6),
  "accepted_at" TIMESTAMPTZ(6),
  "rejected_at" TIMESTAMPTZ(6),
  "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "native_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "native_submissions_state_digest_check"
    CHECK ("state_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "native_submissions_review_round_check"
    CHECK ("review_round" BETWEEN 1 AND 99),
  CONSTRAINT "native_submissions_author_user_id_fkey"
    FOREIGN KEY ("author_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "native_submissions_editor_user_id_fkey"
    FOREIGN KEY ("editor_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "native_submissions_workspace_id_key"
  ON "native_submissions"("workspace_id");
CREATE UNIQUE INDEX "native_submissions_venue_manuscript_key"
  ON "native_submissions"("publication_venue_id", "manuscript_id");
CREATE INDEX "native_submissions_venue_status_submitted_idx"
  ON "native_submissions"("publication_venue_id", "status", "submitted_at");
CREATE INDEX "native_submissions_author_updated_idx"
  ON "native_submissions"("author_user_id", "updated_at");
CREATE INDEX "native_submissions_editor_status_updated_idx"
  ON "native_submissions"("editor_user_id", "status", "updated_at");

CREATE TABLE "native_submission_events" (
  "id" UUID NOT NULL,
  "submission_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "kind" VARCHAR(64) NOT NULL,
  "detail" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "native_submission_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "native_submission_events_submission_id_fkey"
    FOREIGN KEY ("submission_id") REFERENCES "native_submissions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "native_submission_events_submission_created_idx"
  ON "native_submission_events"("submission_id", "created_at");
CREATE INDEX "native_submission_events_actor_created_idx"
  ON "native_submission_events"("actor_user_id", "created_at");
