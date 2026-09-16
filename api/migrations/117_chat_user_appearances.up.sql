-- 只存公开装饰偏好;既有消息与用户数据不受影响。
CREATE TABLE chat_user_appearances (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    avatar_frame_id VARCHAR(64) NOT NULL DEFAULT '',
    avatar_charm_id VARCHAR(64) NOT NULL DEFAULT '',
    bubble_theme_id VARCHAR(64) NOT NULL DEFAULT '',
    revision BIGINT NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 9007199254740991),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE chat_user_appearances IS '聊天公开外观偏好;ID 由应用层素材目录校验';
