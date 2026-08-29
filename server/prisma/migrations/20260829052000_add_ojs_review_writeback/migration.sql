CREATE TABLE "ojs_review_writeback_contexts" (
    "assignment_id" UUID NOT NULL,
    "api_base_url" VARCHAR(2048) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ojs_review_writeback_contexts_pkey" PRIMARY KEY ("assignment_id"),
    CONSTRAINT "ojs_review_writeback_contexts_assignment_id_fkey"
        FOREIGN KEY ("assignment_id") REFERENCES "peer_review_assignments"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
