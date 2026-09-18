ALTER TABLE "users"
  ADD COLUMN "omp_api_key_ciphertext" TEXT,
  ADD COLUMN "omp_api_key_iv" VARCHAR(64),
  ADD COLUMN "omp_api_key_auth_tag" VARCHAR(64),
  ADD COLUMN "omp_api_base_url" VARCHAR(2048);
