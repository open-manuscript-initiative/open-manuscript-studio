CREATE TYPE "PublicationVenueType" AS ENUM ('JOURNAL', 'BOOK_PUBLISHER');

CREATE TABLE "publication_venues" (
    "id" UUID NOT NULL,
    "type" "PublicationVenueType" NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "normalized_name" VARCHAR(300) NOT NULL,
    "website" VARCHAR(2048),
    "issn" VARCHAR(32),
    "isbn_prefix" VARCHAR(64),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "publication_venues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "publication_venues_type_normalized_name_key"
  ON "publication_venues"("type", "normalized_name");
CREATE INDEX "publication_venues_type_normalized_name_idx"
  ON "publication_venues"("type", "normalized_name");

ALTER TABLE "publication_venues"
  ADD CONSTRAINT "publication_venues_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
