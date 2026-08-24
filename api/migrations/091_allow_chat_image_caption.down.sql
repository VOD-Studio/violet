ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS chk_chat_message_payload;

ALTER TABLE chat_messages
    ADD CONSTRAINT chk_chat_message_payload CHECK (
        (message_type = 'text' AND length(btrim(content)) > 0 AND media_id IS NULL)
        OR (message_type = 'image' AND media_id IS NOT NULL AND content = '')
        OR (message_type = 'system' AND length(btrim(content)) > 0 AND media_id IS NULL)
        OR (message_type = 'tweet_share' AND media_id IS NULL AND shared_tweet_id IS NOT NULL)
    );
