-- 118: 聊天徽章持有台账（账号级称号徽章）
-- 只记录「谁被授予哪枚徽章」;佩戴(展示)选择存于 chat_user_appearances.badge_ids,
-- 渲染时与持有集合求交集,撤销授予即自动从展示中消失,无需回写外观行。CREATE TABLE chat_user_badges (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id VARCHAR(64) NOT NULL,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    awarded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX idx_chat_user_badges_badge ON chat_user_badges(badge_id);
