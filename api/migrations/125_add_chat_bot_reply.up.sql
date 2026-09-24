ALTER TABLE chat_bots ADD COLUMN show_thinking BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE chat_messages
    ADD COLUMN bot_status VARCHAR(16),
    ADD COLUMN bot_thinking TEXT NOT NULL DEFAULT '',
    ADD COLUMN bot_revision BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN bot_updated_at TIMESTAMPTZ,
    ADD CONSTRAINT chk_chat_bot_status CHECK (bot_status IS NULL OR bot_status IN ('pending', 'thinking', 'streaming', 'completed', 'failed')),
    ADD CONSTRAINT chk_chat_bot_revision CHECK (bot_revision >= 0);

ALTER TABLE chat_messages DROP CONSTRAINT chk_chat_message_payload;
ALTER TABLE chat_messages ADD CONSTRAINT chk_chat_message_payload CHECK (
    (message_type = 'text' AND (length(btrim(content)) > 0 OR bot_status IN ('pending', 'thinking', 'failed')))
    OR message_type = 'image'
    OR (message_type = 'system' AND length(btrim(content)) > 0)
    OR (message_type = 'tweet_share' AND shared_tweet_id IS NOT NULL)
);
