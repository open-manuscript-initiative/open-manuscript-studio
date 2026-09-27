CREATE TYPE "CollaborationRole" AS ENUM ('OWNER', 'EDITOR', 'AUTHOR', 'VIEWER');
CREATE TYPE "CollaborationInvitationRole" AS ENUM ('EDITOR', 'AUTHOR', 'VIEWER');
CREATE TYPE "CollaborationAuditEventType" AS ENUM ('DOCUMENT_REGISTERED', 'INVITATION_ISSUED', 'INVITATION_ACCEPTED', 'INVITATION_DECLINED', 'INVITATION_REVOKED', 'MEMBER_REVOKED');

CREATE TABLE "collaborative_documents" (
    "id" VARCHAR(128) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "collaborative_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collaboration_members" (
    "id" UUID NOT NULL,
    "document_id" VARCHAR(128) NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "CollaborationRole" NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "collaboration_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collaboration_invitations" (
    "id" UUID NOT NULL,
    "document_id" VARCHAR(128) NOT NULL,
    "invited_by_user_id" UUID NOT NULL,
    "invited_email" VARCHAR(320) NOT NULL,
    "role" "CollaborationInvitationRole" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "declined_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "collaboration_invitations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collaboration_audit_events" (
    "id" UUID NOT NULL,
    "document_id" VARCHAR(128) NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "target_user_id" UUID,
    "type" "CollaborationAuditEventType" NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collaboration_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collaboration_members_document_id_user_id_key" ON "collaboration_members"("document_id", "user_id");
CREATE INDEX "collaborative_documents_owner_user_id_updated_at_idx" ON "collaborative_documents"("owner_user_id", "updated_at");
CREATE INDEX "collaboration_members_user_id_revoked_at_idx" ON "collaboration_members"("user_id", "revoked_at");
CREATE INDEX "collaboration_members_document_id_revoked_at_idx" ON "collaboration_members"("document_id", "revoked_at");
CREATE UNIQUE INDEX "collaboration_invitations_token_hash_key" ON "collaboration_invitations"("token_hash");
CREATE INDEX "collaboration_invitations_document_id_created_at_idx" ON "collaboration_invitations"("document_id", "created_at");
CREATE INDEX "collaboration_invitations_invited_email_expires_at_idx" ON "collaboration_invitations"("invited_email", "expires_at");
CREATE INDEX "collaboration_audit_events_document_id_created_at_idx" ON "collaboration_audit_events"("document_id", "created_at");
CREATE INDEX "collaboration_audit_events_actor_user_id_created_at_idx" ON "collaboration_audit_events"("actor_user_id", "created_at");

ALTER TABLE "collaborative_documents" ADD CONSTRAINT "collaborative_documents_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_members" ADD CONSTRAINT "collaboration_members_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "collaborative_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_members" ADD CONSTRAINT "collaboration_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_invitations" ADD CONSTRAINT "collaboration_invitations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "collaborative_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_invitations" ADD CONSTRAINT "collaboration_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_audit_events" ADD CONSTRAINT "collaboration_audit_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "collaborative_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_audit_events" ADD CONSTRAINT "collaboration_audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_audit_events" ADD CONSTRAINT "collaboration_audit_events_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
