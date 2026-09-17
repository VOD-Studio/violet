-- 只存公开装饰偏好;既有消息与用户数据不受影响。
-- badge_ids 以 JSON 数组存放佩戴中的徽章 ID(有序,至多 3 枚);持有台账在 chat_user_badges(118),
-- 渲染读取时两表求交集,撤销授予即自动从展示中消失。
CREATE TABLE chat_user_appearances (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    avatar_frame_id VARCHAR(64) NOT NULL DEFAULT '',
    avatar_charm_id VARCHAR(64) NOT NULL DEFAULT '',
    bubble_theme_id VARCHAR(64) NOT NULL DEFAULT '',
    badge_ids JSONB NOT NULL DEFAULT '[]',
    revision BIGINT NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 9007199254740991),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE chat_user_appearances IS '聊天公开外观偏好;ID 由应用层素材目录校验';
