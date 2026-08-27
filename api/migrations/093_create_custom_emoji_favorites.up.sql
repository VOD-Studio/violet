-- 093: 自定义表情收藏关系（引用式，非拷贝；表情下架/删除级联清理）
CREATE TABLE custom_emoji_favorites (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji_id   UUID NOT NULL REFERENCES custom_emojis(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, emoji_id)
);

CREATE INDEX idx_custom_emoji_favorites_user ON custom_emoji_favorites(user_id);
