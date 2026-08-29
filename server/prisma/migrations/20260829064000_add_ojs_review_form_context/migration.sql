CREATE TABLE "ojs_review_form_contexts" (
    "assignment_id" UUID NOT NULL,
    "form_external_id" VARCHAR(128),
    "definition" JSONB,
    "responses" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ojs_review_form_contexts_pkey" PRIMARY KEY ("assignment_id"),
    CONSTRAINT "ojs_review_form_contexts_assignment_id_fkey"
        FOREIGN KEY ("assignment_id") REFERENCES "peer_review_assignments"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
