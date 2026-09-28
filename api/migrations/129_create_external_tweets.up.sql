CREATE TABLE external_tweets (
    id UUID PRIMARY KEY,
    platform TEXT NOT NULL DEFAULT 'x' CHECK (platform = 'x'),
    source_id VARCHAR(20) NOT NULL CHECK (source_id ~ '^[1-9][0-9]{0,19}$'),
    canonical_url TEXT NOT NULL,
    snapshot JSONB,
    quoted_external_tweet_id UUID REFERENCES external_tweets(id) ON DELETE RESTRICT,
    fetch_source TEXT NOT NULL DEFAULT '' CHECK (fetch_source IN ('', 'fxtwitter', 'syndication')),
    snapshot_version TEXT NOT NULL DEFAULT '',
    fingerprint TEXT NOT NULL DEFAULT '',
    availability TEXT NOT NULL DEFAULT 'unavailable' CHECK (availability IN ('available', 'unavailable', 'deleted', 'private')),
    fetched_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_error TEXT NOT NULL DEFAULT '',
    protected_until TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    taken_down BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (platform, source_id),
    CHECK (quoted_external_tweet_id IS NULL OR quoted_external_tweet_id <> id)
);
CREATE INDEX idx_external_tweets_checked ON external_tweets(last_checked_at, id);
CREATE INDEX idx_external_tweets_quote ON external_tweets(quoted_external_tweet_id) WHERE quoted_external_tweet_id IS NOT NULL;

ALTER TABLE tweets ADD COLUMN external_tweet_id UUID REFERENCES external_tweets(id) ON DELETE RESTRICT;
ALTER TABLE tweets ADD COLUMN client_request_id UUID;
ALTER TABLE tweets ADD COLUMN request_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE tweets ADD COLUMN external_preview_token_hash TEXT;
ALTER TABLE tweets ADD CONSTRAINT tweets_quote_source_exclusive CHECK (quote_of IS NULL OR external_tweet_id IS NULL);
CREATE INDEX idx_tweets_external ON tweets(external_tweet_id) WHERE external_tweet_id IS NOT NULL;
CREATE UNIQUE INDEX idx_tweets_author_request ON tweets(author_id, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE UNIQUE INDEX idx_tweets_preview_token ON tweets(external_preview_token_hash) WHERE external_preview_token_hash IS NOT NULL;
