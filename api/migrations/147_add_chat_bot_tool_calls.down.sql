ALTER TABLE chat_messages
    DROP CONSTRAINT chk_chat_bot_tool_calls,
    DROP COLUMN bot_tool_calls;