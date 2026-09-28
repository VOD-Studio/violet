DROP INDEX IF EXISTS idx_tweets_author_request;
DROP INDEX IF EXISTS idx_tweets_preview_token;
DROP INDEX IF EXISTS idx_tweets_external;
ALTER TABLE tweets DROP CONSTRAINT IF EXISTS tweets_quote_source_exclusive;
ALTER TABLE tweets DROP COLUMN request_hash;
ALTER TABLE tweets DROP COLUMN external_preview_token_hash;
ALTER TABLE tweets DROP COLUMN client_request_id;
ALTER TABLE tweets DROP COLUMN external_tweet_id;
DROP TABLE external_tweets;
