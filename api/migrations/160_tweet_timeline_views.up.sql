ALTER TABLE tweets ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0 CHECK (view_count >= 0);

CREATE INDEX idx_tweets_image_timeline ON tweets (created_at DESC, id DESC) WHERE images <> '[]'::jsonb;
