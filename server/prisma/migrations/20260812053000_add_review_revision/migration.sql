ALTER TABLE "peer_review_assignments"
ADD COLUMN "review_revision_snapshot" JSONB,
ADD COLUMN "revision_updated_at" TIMESTAMPTZ(6);
