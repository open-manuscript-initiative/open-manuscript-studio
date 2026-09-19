CREATE TABLE "omp_native_contexts" (
    "id" UUID NOT NULL,
    "assignment_id" UUID,
    "user_id" UUID,
    "installation_id" VARCHAR(128) NOT NULL,
    "api_base_url" VARCHAR(2048) NOT NULL,
    "external_submission_id" VARCHAR(128) NOT NULL,
    "external_actor_id" VARCHAR(128) NOT NULL,
    "actor_mode" VARCHAR(16) NOT NULL,
    "external_assignment_id" VARCHAR(128),
    "external_review_round_id" VARCHAR(128),
    "review_round" INTEGER,
    "stage_id" INTEGER,
    "component_external_id" VARCHAR(128),
    "source_submission_file_external_id" VARCHAR(128),
    "source_genre_external_id" VARCHAR(128),
    "capabilities" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "writable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "omp_native_contexts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "omp_native_contexts_assignment_id_fkey"
        FOREIGN KEY ("assignment_id") REFERENCES "peer_review_assignments"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "omp_native_contexts_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "omp_native_contexts_assignment_id_key"
    ON "omp_native_contexts"("assignment_id")
    WHERE "assignment_id" IS NOT NULL;

CREATE UNIQUE INDEX "omp_native_contexts_author_key"
    ON "omp_native_contexts"("user_id", "installation_id", "external_submission_id", "actor_mode")
    WHERE "assignment_id" IS NULL AND "user_id" IS NOT NULL;

CREATE INDEX "omp_native_contexts_installation_submission_idx"
    ON "omp_native_contexts"("installation_id", "external_submission_id");

CREATE INDEX "omp_native_contexts_user_actor_idx"
    ON "omp_native_contexts"("user_id", "actor_mode");
