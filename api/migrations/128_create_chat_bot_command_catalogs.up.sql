CREATE TABLE chat_bot_command_catalogs (
    bot_id UUID PRIMARY KEY REFERENCES chat_bots(id) ON DELETE CASCADE,
    schema_version INTEGER NOT NULL,
    revision VARCHAR(64) NOT NULL,
    commands JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
