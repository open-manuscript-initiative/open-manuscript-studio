-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReviewRecommendation" AS ENUM ('ACCEPT', 'MINOR_REVISION', 'MAJOR_REVISION', 'REJECT');

-- CreateEnum
CREATE TYPE "ReviewAnonymityMode" AS ENUM ('DOUBLE_BLIND', 'SINGLE_BLIND', 'OPEN');

-- CreateEnum
CREATE TYPE "ReviewFeedbackVisibility" AS ENUM ('AUTHOR_AND_EDITOR', 'EDITOR_ONLY');

-- CreateTable
CREATE TABLE "peer_review_assignments" (
    "id" UUID NOT NULL,
    "workspace_id" VARCHAR(128) NOT NULL,
    "manuscript_id" VARCHAR(128) NOT NULL,
    "reviewer_user_id" UUID NOT NULL,
    "assigned_by_user_id" UUID NOT NULL,
    "reviewer_alias" VARCHAR(64) NOT NULL,
    "review_round" INTEGER NOT NULL DEFAULT 1,
    "anonymity_mode" "ReviewAnonymityMode" NOT NULL DEFAULT 'DOUBLE_BLIND',
    "status" "ReviewStatus" NOT NULL DEFAULT 'INVITED',
    "recommendation" "ReviewRecommendation",
    "invited_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "peer_review_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peer_review_feedback" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "visibility" "ReviewFeedbackVisibility" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "peer_review_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "peer_review_assignments_workspace_id_reviewer_user_id_review_round_key"
ON "peer_review_assignments"("workspace_id", "reviewer_user_id", "review_round");

-- CreateIndex
CREATE INDEX "peer_review_assignments_workspace_id_status_idx"
ON "peer_review_assignments"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "peer_review_assignments_manuscript_id_idx"
ON "peer_review_assignments"("manuscript_id");

-- CreateIndex
CREATE INDEX "peer_review_assignments_reviewer_user_id_status_idx"
ON "peer_review_assignments"("reviewer_user_id", "status");

-- CreateIndex
CREATE INDEX "peer_review_feedback_assignment_id_visibility_idx"
ON "peer_review_feedback"("assignment_id", "visibility");

-- AddForeignKey
ALTER TABLE "peer_review_assignments"
ADD CONSTRAINT "peer_review_assignments_reviewer_user_id_fkey"
FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_review_assignments"
ADD CONSTRAINT "peer_review_assignments_assigned_by_user_id_fkey"
FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_review_feedback"
ADD CONSTRAINT "peer_review_feedback_assignment_id_fkey"
FOREIGN KEY ("assignment_id") REFERENCES "peer_review_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
