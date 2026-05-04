-- 评论表情反应表
CREATE TABLE comment_reactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id    UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    emoji_id      INT NOT NULL REFERENCES emojis(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_hash       VARCHAR(64),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 约束：同一用户对同一评论的同一表情只能反应一次
    CONSTRAINT unique_user_reaction UNIQUE (comment_id, emoji_id, user_id)
);

-- 唯一索引：同一 IP 对同一评论的同一表情只能反应一次（仅匿名用户）
CREATE UNIQUE INDEX unique_ip_reaction ON comment_reactions(comment_id, emoji_id, ip_hash)
    WHERE user_id IS NULL;

-- 索引：按评论查询所有反应（用于显示）
CREATE INDEX idx_reactions_comment ON comment_reactions(comment_id);

-- 索引：按表情查询（用于统计）
CREATE INDEX idx_reactions_emoji ON comment_reactions(emoji_id);

-- 索引：按用户查询（用于判断用户是否已反应）
CREATE INDEX idx_reactions_user ON comment_reactions(user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE comment_reactions IS '评论表情反应';
COMMENT ON COLUMN comment_reactions.comment_id IS '评论 ID';
COMMENT ON COLUMN comment_reactions.emoji_id IS '表情 ID';
COMMENT ON COLUMN comment_reactions.user_id IS '用户 ID（登录用户）';
COMMENT ON COLUMN comment_reactions.ip_hash IS 'IP 哈希（匿名用户）';
