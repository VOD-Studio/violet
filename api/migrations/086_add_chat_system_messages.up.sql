-- 086: 群聊系统事件消息
ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS chat_messages_message_type_check,
    DROP CONSTRAINT IF EXISTS chk_chat_message_payload;

ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_message_type_check
        CHECK (message_type IN ('text', 'image', 'system')),
    ADD CONSTRAINT chk_chat_message_payload CHECK (
        (message_type = 'text' AND length(btrim(content)) > 0 AND media_id IS NULL)
        OR (message_type = 'image' AND media_id IS NOT NULL AND content = '')
        OR (message_type = 'system' AND length(btrim(content)) > 0 AND media_id IS NULL)
    );
