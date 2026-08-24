-- 090: chat_messages 的 CHECK 约束补齐 tweet_share 类型
-- 089 新增 shared_tweet_id 列与领域层 MessageTweetShare，但漏改 086 遗留的两个
-- CHECK 约束，导致分享推文到聊天时插入被 chat_messages_message_type_check 拒绝。
ALTER TABLE chat_messages
    DROP CONSTRAINT IF EXISTS chat_messages_message_type_check,
    DROP CONSTRAINT IF EXISTS chk_chat_message_payload;

ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_message_type_check
        CHECK (message_type IN ('text', 'image', 'system', 'tweet_share')),
    ADD CONSTRAINT chk_chat_message_payload CHECK (
        (message_type = 'text' AND length(btrim(content)) > 0 AND media_id IS NULL)
        OR (message_type = 'image' AND media_id IS NOT NULL AND content = '')
        OR (message_type = 'system' AND length(btrim(content)) > 0 AND media_id IS NULL)
        OR (message_type = 'tweet_share' AND media_id IS NULL AND shared_tweet_id IS NOT NULL)
    );
