CREATE TYPE "PublicationVenueIntegrationProvider" AS ENUM ('OJS', 'OMP');
CREATE TYPE "PublicationVenueIntegrationStatus" AS ENUM ('VERIFIED', 'DISABLED');

ALTER TABLE "publication_venues"
  ADD COLUMN "integration_provider" "PublicationVenueIntegrationProvider",
  ADD COLUMN "integration_status" "PublicationVenueIntegrationStatus" NOT NULL DEFAULT 'DISABLED',
  ADD COLUMN "integration_installation_id" VARCHAR(128),
  ADD COLUMN "integration_base_url" VARCHAR(2048),
  ADD COLUMN "integration_verified_at" TIMESTAMPTZ(6);

CREATE INDEX "publication_venues_type_integration_status_idx"
  ON "publication_venues"("type", "integration_status");
CREATE INDEX "publication_venues_integration_installation_id_idx"
  ON "publication_venues"("integration_installation_id");
