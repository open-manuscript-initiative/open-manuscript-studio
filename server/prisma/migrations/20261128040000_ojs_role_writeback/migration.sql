ALTER TABLE ojs_review_writeback_contexts
  ADD COLUMN assignment_token TEXT,
  ADD COLUMN receipt JSONB,
  ADD COLUMN last_error TEXT,
  ADD COLUMN synced_at TIMESTAMPTZ(6);
-- Correct historic defaults; scientific peer review always uses double anonymity.
UPDATE peer_review_assignments SET anonymity_mode = 'OPEN'
 WHERE assignment_type IN ('LANGUAGE_REVIEW', 'TRANSLATION');
UPDATE peer_review_assignments SET anonymity_mode = 'DOUBLE_BLIND'
 WHERE assignment_type = 'SCIENTIFIC_REVIEW';
