-- Optimize operator-controlled age-limited purges. Do not change publication provenance.
CREATE INDEX IF NOT EXISTS "integration_audit_events_created_at_idx"
  ON "integration_audit_events" ("created_at");
CREATE INDEX IF NOT EXISTS "studio_module_audit_events_created_at_idx"
  ON "studio_module_audit_events" ("created_at");
CREATE INDEX IF NOT EXISTS "collaboration_audit_events_created_at_idx"
  ON "collaboration_audit_events" ("created_at");
