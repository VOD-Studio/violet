-- 091: chat_messages 图片消息放开 content 必须为空的约束（PRD-0019 图文合一）
-- 单图+文字合一发送场景下 image 类型消息允许携带非空 content（说明文字/caption）。
ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS chk_chat_message_payload;

ALTER TABLE chat_messages
    ADD CONSTRAINT chk_chat_message_payload CHECK (
        (message_type = 'text' AND length(btrim(content)) > 0 AND media_id IS NULL)
        OR (message_type = 'image' AND media_id IS NOT NULL)
        OR (message_type = 'system' AND length(btrim(content)) > 0 AND media_id IS NULL)
        OR (message_type = 'tweet_share' AND media_id IS NULL AND shared_tweet_id IS NOT NULL)
    );
