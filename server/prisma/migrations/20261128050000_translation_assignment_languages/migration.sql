ALTER TABLE peer_review_assignments ADD COLUMN publication_languages TEXT[] NOT NULL DEFAULT '{}';
UPDATE peer_review_assignments SET publication_languages = ARRAY[source_language] WHERE assignment_type = 'TRANSLATION' AND source_language IS NOT NULL;
