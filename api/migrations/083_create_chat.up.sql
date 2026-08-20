-- 082: 集中式私域聊天
CREATE TABLE chat_conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind            VARCHAR(16) NOT NULL CHECK (kind IN ('direct', 'room')),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(80) NOT NULL DEFAULT '',
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_conversations_updated ON chat_conversations(updated_at DESC, id DESC);

CREATE TABLE chat_conversation_members (
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(16) NOT NULL CHECK (role IN ('owner', 'member')),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at         TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_chat_members_user_active
    ON chat_conversation_members(user_id, conversation_id)
    WHERE left_at IS NULL;

CREATE TABLE chat_direct_pairs (
    conversation_id UUID PRIMARY KEY REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_a_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    CHECK (user_a_id < user_b_id),
    UNIQUE (user_a_id, user_b_id)
);

CREATE TABLE chat_messages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_type     VARCHAR(16) NOT NULL CHECK (message_type IN ('text', 'image')),
    content          TEXT NOT NULL DEFAULT '',
    media_id         UUID REFERENCES files(id) ON DELETE RESTRICT,
    idempotency_key  VARCHAR(128) NOT NULL,
    deleted_at       TIMESTAMPTZ,
    deleted_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_chat_message_idempotency UNIQUE (conversation_id, sender_id, idempotency_key),
    CONSTRAINT chk_chat_message_payload CHECK (
        (message_type = 'text' AND length(btrim(content)) > 0 AND media_id IS NULL)
        OR (message_type = 'image' AND media_id IS NOT NULL AND content = '')
    )
);

CREATE INDEX idx_chat_messages_conversation_created
    ON chat_messages(conversation_id, created_at DESC, id DESC);

CREATE TABLE chat_read_positions (
    conversation_id   UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_id   UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    read_at           TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE chat_events (
    sequence         BIGSERIAL PRIMARY KEY,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type       VARCHAR(40) NOT NULL CHECK (event_type IN ('message.created', 'room.invited', 'member.changed', 'message.deleted')),
    payload          JSONB NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_events_user_sequence ON chat_events(user_id, sequence);

CREATE TABLE chat_push_subscriptions (
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint         TEXT PRIMARY KEY,
    p256dh           TEXT NOT NULL,
    auth             TEXT NOT NULL,
    user_agent       TEXT NOT NULL DEFAULT '',
    show_preview     BOOLEAN NOT NULL DEFAULT false,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_push_subscriptions_user ON chat_push_subscriptions(user_id);

INSERT INTO permissions (code, name)
VALUES ('chat:manage', '管理聊天消息')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.code = 'chat:manage'
ON CONFLICT DO NOTHING;
