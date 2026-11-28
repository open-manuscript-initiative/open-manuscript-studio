ALTER TABLE users ADD COLUMN translation_language_pairs JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD CONSTRAINT translation_language_pairs_array CHECK (jsonb_typeof(translation_language_pairs) = 'array');
