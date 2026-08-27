CREATE TABLE chat_message_reactions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    emoji_id   INTEGER NOT NULL REFERENCES emojis(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_chat_message_reaction UNIQUE (message_id, emoji_id, user_id)
);

CREATE INDEX idx_chat_message_reactions_message
    ON chat_message_reactions(message_id);

ALTER TABLE chat_events
    DROP CONSTRAINT IF EXISTS chat_events_event_type_check;

ALTER TABLE chat_events
    ADD CONSTRAINT chat_events_event_type_check
        CHECK (event_type IN (
            'message.created',
            'room.invited',
            'member.changed',
            'message.deleted',
            'message.reaction.updated'
        ));
