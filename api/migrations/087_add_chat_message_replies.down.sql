DROP INDEX IF EXISTS idx_chat_messages_reply_to;

ALTER TABLE chat_messages
    DROP COLUMN IF EXISTS reply_to_id;
