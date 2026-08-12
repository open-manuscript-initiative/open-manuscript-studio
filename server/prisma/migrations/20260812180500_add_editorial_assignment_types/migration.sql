-- CreateEnum
CREATE TYPE "ReviewAssignmentType" AS ENUM (
  'SCIENTIFIC_REVIEW',
  'LANGUAGE_REVIEW',
  'TRANSLATION',
  'EDITORIAL_REVISION'
);

-- AlterTable
ALTER TABLE "peer_review_assignments"
ADD COLUMN "assignment_type" "ReviewAssignmentType" NOT NULL DEFAULT 'SCIENTIFIC_REVIEW',
ADD COLUMN "source_language" VARCHAR(32),
ADD COLUMN "target_language" VARCHAR(32);

-- Replace the legacy uniqueness rule so the same participant may hold
-- different editorial assignments in the same manuscript round.
DROP INDEX "peer_review_assignments_workspace_id_reviewer_user_id_review_round_key";
CREATE UNIQUE INDEX "peer_review_assignments_workspace_user_round_type_key"
ON "peer_review_assignments"("workspace_id", "reviewer_user_id", "review_round", "assignment_type");

-- CreateIndex
CREATE INDEX "peer_review_assignments_workspace_type_status_idx"
ON "peer_review_assignments"("workspace_id", "assignment_type", "status");
