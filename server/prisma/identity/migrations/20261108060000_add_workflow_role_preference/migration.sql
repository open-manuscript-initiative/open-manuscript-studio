ALTER TABLE "users"
  ADD COLUMN "workflow_role" VARCHAR(32) NOT NULL DEFAULT 'general';

ALTER TABLE "users" ADD CONSTRAINT "users_workflow_role_preference_check"
  CHECK ("workflow_role" IN ('general', 'author', 'editor', 'reviewer', 'translator', 'copyeditor', 'layout-editor'));
