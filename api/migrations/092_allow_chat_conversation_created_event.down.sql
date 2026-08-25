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
