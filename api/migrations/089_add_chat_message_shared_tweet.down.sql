DROP INDEX IF EXISTS idx_chat_messages_shared_tweet;

ALTER TABLE chat_messages
    DROP COLUMN IF EXISTS shared_tweet_id;
