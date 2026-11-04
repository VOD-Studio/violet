ALTER TABLE chat_messages
    ADD COLUMN bot_tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD CONSTRAINT chk_chat_bot_tool_calls CHECK (jsonb_typeof(bot_tool_calls) = 'array');