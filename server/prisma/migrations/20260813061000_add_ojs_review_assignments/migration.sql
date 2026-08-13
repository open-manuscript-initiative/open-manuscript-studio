ALTER TABLE "peer_review_assignments"
  ALTER COLUMN "assigned_by_user_id" DROP NOT NULL,
  ADD COLUMN "external_installation_id" VARCHAR(128),
  ADD COLUMN "external_assignment_id" VARCHAR(128);

CREATE UNIQUE INDEX "peer_review_assignments_external_installation_id_external_assignment_id_key"
  ON "peer_review_assignments"("external_installation_id", "external_assignment_id");
