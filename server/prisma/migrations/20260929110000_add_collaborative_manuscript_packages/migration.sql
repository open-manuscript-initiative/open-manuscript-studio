CREATE TABLE "collaborative_document_packages" (
    "document_id" VARCHAR(128) NOT NULL,
    "package_bytes" BYTEA NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "package_version" VARCHAR(32) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "collaborative_document_packages_pkey" PRIMARY KEY ("document_id")
);

ALTER TABLE "collaborative_document_packages"
ADD CONSTRAINT "collaborative_document_packages_document_id_fkey"
FOREIGN KEY ("document_id") REFERENCES "collaborative_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
