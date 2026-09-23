ALTER TABLE chat_messages DROP CONSTRAINT chk_chat_message_payload;
UPDATE chat_messages SET content = '[Bot 回复未完成]'
WHERE bot_status IS NOT NULL AND length(btrim(content)) = 0;
ALTER TABLE chat_messages ADD CONSTRAINT chk_chat_message_payload CHECK (
    (message_type = 'text' AND length(btrim(content)) > 0)
    OR message_type = 'image'
    OR (message_type = 'system' AND length(btrim(content)) > 0)
    OR (message_type = 'tweet_share' AND shared_tweet_id IS NOT NULL)
);
ALTER TABLE chat_messages
    DROP CONSTRAINT chk_chat_bot_revision,
    DROP CONSTRAINT chk_chat_bot_status,
    DROP COLUMN bot_updated_at,
    DROP COLUMN bot_revision,
    DROP COLUMN bot_thinking,
    DROP COLUMN bot_status;
ALTER TABLE chat_bots DROP COLUMN show_thinking;
