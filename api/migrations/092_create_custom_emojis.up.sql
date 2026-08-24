-- 092: 自定义表情（用户自助上传，默认私有）
CREATE TABLE custom_emojis (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(50) NOT NULL,
    url        VARCHAR(512) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_custom_emojis_owner_name
    ON custom_emojis(owner_id, name)
    WHERE deleted_at IS NULL;
