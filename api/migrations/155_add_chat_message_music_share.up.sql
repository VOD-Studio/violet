ALTER TABLE chat_messages
    ADD COLUMN music_share JSONB,
    DROP CONSTRAINT chat_messages_message_type_check,
    DROP CONSTRAINT chk_chat_message_payload;

ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_message_type_check
        CHECK (message_type IN ('text', 'image', 'system', 'tweet_share', 'music_share')),
    ADD CONSTRAINT chk_chat_message_payload CHECK (
        (message_type = 'text' AND (length(btrim(content)) > 0 OR bot_status IN ('pending', 'thinking', 'failed')))
        OR message_type = 'image'
        OR (message_type = 'system' AND length(btrim(content)) > 0)
        OR (message_type = 'tweet_share' AND shared_tweet_id IS NOT NULL)
        OR (message_type = 'music_share' AND music_share IS NOT NULL)
    );
