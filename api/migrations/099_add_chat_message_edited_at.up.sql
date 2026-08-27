-- 099: 消息编辑（发送者可修订自己已发送的消息）
-- edited_at 为空表示从未编辑；编辑是原地更新，不保留历史版本。
-- message.updated 事件通知会话成员刷新消息，需放行 chat_events 的事件类型 CHECK。
ALTER TABLE chat_messages
    ADD COLUMN edited_at TIMESTAMPTZ;

ALTER TABLE chat_events
    DROP CONSTRAINT IF EXISTS chat_events_event_type_check;

ALTER TABLE chat_events
    ADD CONSTRAINT chat_events_event_type_check
        CHECK (event_type IN (
            'message.created',
            'room.invited',
            'conversation.created',
            'member.changed',
            'message.deleted',
            'message.reaction.updated',
            'message.updated'
        ));
