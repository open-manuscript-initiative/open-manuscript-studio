-- Persist OJS-authoritative reviewer recommendation options per concrete Studio assignment.
ALTER TABLE "peer_review_assignments"
ADD COLUMN "external_recommendation_id" VARCHAR(128),
ADD COLUMN "external_recommendation_storage" VARCHAR(16),
ADD COLUMN "external_recommendation_options" JSONB;
