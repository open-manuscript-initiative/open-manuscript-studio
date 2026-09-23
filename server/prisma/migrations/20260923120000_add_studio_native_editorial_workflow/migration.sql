CREATE TYPE "NativeEditorialSubmissionStatus" AS ENUM (
  'SUBMITTED',
  'IN_REVIEW',
  'REVISION_REQUESTED',
  'REVISION_SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'PUBLISHED'
);

CREATE TYPE "NativeEditorialEventType" AS ENUM (
  'SUBMITTED',
  'REVIEWER_ASSIGNED',
  'REVIEW_COMPLETED',
  'REVISION_REQUESTED',
  'REVISION_SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'PUBLISHED'
);

CREATE TABLE "native_editorial_submissions" (
  "id" UUID NOT NULL,
  "workspace_id" VARCHAR(128) NOT NULL,
  "manuscript_id" VARCHAR(128) NOT NULL,
  "publication_venue_id" UUID NOT NULL,
  "publication_venue_name" VARCHAR(300) NOT NULL,
  "publication_venue_domain" VARCHAR(253) NOT NULL,
  "author_user_id" UUID NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "revision_id" VARCHAR(128) NOT NULL,
  "state_digest" VARCHAR(64) NOT NULL,
  "publication_content_digest" VARCHAR(64) NOT NULL,
  "manuscript_state_snapshot" JSONB NOT NULL,
  "review_snapshot" JSONB NOT NULL,
  "status" "NativeEditorialSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "review_round" INTEGER NOT NULL DEFAULT 1,
  "editorial_note" TEXT,
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revision_requested_at" TIMESTAMPTZ(6),
  "revision_submitted_at" TIMESTAMPTZ(6),
  "accepted_at" TIMESTAMPTZ(6),
  "rejected_at" TIMESTAMPTZ(6),
  "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "native_editorial_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "native_editorial_submissions_review_round_check"
    CHECK ("review_round" BETWEEN 1 AND 99),
  CONSTRAINT "native_editorial_submissions_digest_check"
    CHECK (
      "state_digest" ~ '^[0-9a-f]{64}$'
      AND "publication_content_digest" ~ '^[0-9a-f]{64}$'
    ),
  CONSTRAINT "native_editorial_submissions_author_user_id_fkey"
    FOREIGN KEY ("author_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "native_editorial_submissions_workspace_id_key"
  ON "native_editorial_submissions"("workspace_id");
CREATE UNIQUE INDEX "native_editorial_submissions_author_venue_manuscript_key"
  ON "native_editorial_submissions"("author_user_id", "publication_venue_id", "manuscript_id");
CREATE INDEX "native_editorial_submissions_venue_status_updated_idx"
  ON "native_editorial_submissions"("publication_venue_id", "status", "updated_at");
CREATE INDEX "native_editorial_submissions_author_status_updated_idx"
  ON "native_editorial_submissions"("author_user_id", "status", "updated_at");
CREATE INDEX "native_editorial_submissions_manuscript_revision_idx"
  ON "native_editorial_submissions"("manuscript_id", "revision_id");

CREATE TABLE "native_editorial_submission_events" (
  "id" UUID NOT NULL,
  "submission_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "type" "NativeEditorialEventType" NOT NULL,
  "review_round" INTEGER NOT NULL,
  "revision_id" VARCHAR(128),
  "state_digest" VARCHAR(64),
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "native_editorial_submission_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "native_editorial_submission_events_review_round_check"
    CHECK ("review_round" BETWEEN 1 AND 99),
  CONSTRAINT "native_editorial_submission_events_state_digest_check"
    CHECK (
      "state_digest" IS NULL
      OR "state_digest" ~ '^[0-9a-f]{64}$'
    ),
  CONSTRAINT "native_editorial_submission_events_submission_id_fkey"
    FOREIGN KEY ("submission_id") REFERENCES "native_editorial_submissions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "native_editorial_submission_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "native_editorial_submission_events_submission_created_idx"
  ON "native_editorial_submission_events"("submission_id", "created_at");
CREATE INDEX "native_editorial_submission_events_actor_created_idx"
  ON "native_editorial_submission_events"("actor_user_id", "created_at");
