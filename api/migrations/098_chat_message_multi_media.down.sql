ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS chk_chat_message_payload;

ALTER TABLE chat_messages
    ADD COLUMN media_id UUID REFERENCES files(id) ON DELETE RESTRICT;

-- 多图消息只回写首图（position = 0），其余关联随关联表删除丢失，降级不保证无损。
UPDATE chat_messages m SET media_id = mm.media_id
FROM chat_message_media mm
WHERE mm.message_id = m.id AND mm.position = 0;

ALTER TABLE chat_messages
    ADD CONSTRAINT chk_chat_message_payload CHECK (
        (message_type = 'text' AND length(btrim(content)) > 0 AND media_id IS NULL)
        OR (message_type = 'image' AND media_id IS NOT NULL)
        OR (message_type = 'system' AND length(btrim(content)) > 0 AND media_id IS NULL)
        OR (message_type = 'tweet_share' AND media_id IS NULL AND shared_tweet_id IS NOT NULL)
    );

DROP TABLE chat_message_media;
