ALTER TABLE "editorial_decisions"
  ADD COLUMN "publication_venue_id" UUID,
  ADD COLUMN "authority_snapshot" JSONB;

CREATE INDEX "editorial_decisions_publication_venue_id_decided_at_idx"
  ON "editorial_decisions"("publication_venue_id", "decided_at");
