CREATE TYPE "PublicationVenueDomainVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED');
CREATE TYPE "PublicationVenueRole" AS ENUM ('DOMAIN_ADMIN', 'EDITOR_IN_CHIEF', 'EDITOR');

CREATE TABLE "publication_venue_domain_verifications" (
  "id" UUID NOT NULL,
  "venue_id" UUID NOT NULL,
  "domain" VARCHAR(253) NOT NULL,
  "txt_record_name" VARCHAR(300) NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "status" "PublicationVenueDomainVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by_user_id" UUID NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "verified_at" TIMESTAMPTZ(6),
  "last_checked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "publication_venue_domain_verifications_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "publication_venue_memberships" (
  "id" UUID NOT NULL,
  "venue_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "PublicationVenueRole" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "granted_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "publication_venue_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "publication_venue_domain_verifications_venue_id_domain_key" ON "publication_venue_domain_verifications"("venue_id", "domain");
CREATE INDEX "publication_venue_domain_verifications_domain_status_idx" ON "publication_venue_domain_verifications"("domain", "status");
CREATE INDEX "publication_venue_domain_verifications_requested_by_user_id_status_idx" ON "publication_venue_domain_verifications"("requested_by_user_id", "status");
CREATE UNIQUE INDEX "publication_venue_memberships_venue_id_user_id_key" ON "publication_venue_memberships"("venue_id", "user_id");
CREATE INDEX "publication_venue_memberships_venue_id_role_active_idx" ON "publication_venue_memberships"("venue_id", "role", "active");
CREATE INDEX "publication_venue_memberships_user_id_active_idx" ON "publication_venue_memberships"("user_id", "active");
ALTER TABLE "publication_venue_domain_verifications" ADD CONSTRAINT "publication_venue_domain_verifications_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "publication_venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publication_venue_domain_verifications" ADD CONSTRAINT "publication_venue_domain_verifications_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publication_venue_memberships" ADD CONSTRAINT "publication_venue_memberships_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "publication_venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publication_venue_memberships" ADD CONSTRAINT "publication_venue_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publication_venue_memberships" ADD CONSTRAINT "publication_venue_memberships_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
