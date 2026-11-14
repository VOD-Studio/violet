ALTER TABLE chat_messages
    DROP CONSTRAINT chat_messages_message_type_check,
    DROP CONSTRAINT chk_chat_message_payload;

-- 回退时保留配文与歌名，避免为恢复旧类型约束删除历史消息。
UPDATE chat_messages
SET message_type = 'text',
    content = concat_ws(E'\n', NULLIF(btrim(content), ''), '分享了一首歌曲：' || (music_share->>'title'))
WHERE message_type = 'music_share';

ALTER TABLE chat_messages
    DROP COLUMN music_share,
    ADD CONSTRAINT chat_messages_message_type_check
        CHECK (message_type IN ('text', 'image', 'system', 'tweet_share')),
    ADD CONSTRAINT chk_chat_message_payload CHECK (
        (message_type = 'text' AND (length(btrim(content)) > 0 OR bot_status IN ('pending', 'thinking', 'failed')))
        OR message_type = 'image'
        OR (message_type = 'system' AND length(btrim(content)) > 0)
        OR (message_type = 'tweet_share' AND shared_tweet_id IS NOT NULL)
    );
