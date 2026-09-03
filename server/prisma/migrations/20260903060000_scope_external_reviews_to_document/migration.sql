-- External review assignments distinguish the parent submission from the
-- exact article/chapter shown in Studio. Existing OJS rows use the same ID for
-- both values and are backfilled without changing their reviewer workspace.
ALTER TABLE "peer_review_assignments"
ADD COLUMN "external_submission_id" VARCHAR(128);

UPDATE "peer_review_assignments"
SET "external_submission_id" = "manuscript_id"
WHERE "external_installation_id" IS NOT NULL;

-- A reviewer may receive several submissions or book chapters in the same
-- context and round. Uniqueness therefore includes the assigned document.
DROP INDEX "peer_review_assignments_workspace_user_round_type_key";
CREATE UNIQUE INDEX "peer_review_assignments_workspace_manuscript_user_round_type_key"
ON "peer_review_assignments"(
  "workspace_id",
  "manuscript_id",
  "reviewer_user_id",
  "review_round",
  "assignment_type"
);

CREATE INDEX "peer_review_assignments_external_submission_id_idx"
ON "peer_review_assignments"("external_submission_id");
