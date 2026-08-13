-- 078: notifications 表（PRD-0015 全站通知系统 / issue #184）
-- 非规范化单表：每个接收者一行，零 JOIN 查询。
-- 写时扇出：事件发生时给每个接收者写一行通知。

CREATE TABLE notifications (
    id          UUID        PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    source_id   UUID        NOT NULL,
    title       VARCHAR(200) NOT NULL,
    body        TEXT        NOT NULL DEFAULT '',
    payload     JSONB       NOT NULL DEFAULT '{}',
    read_at     TIMESTAMPTZ NULL,  -- NULL = 未读
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 通知列表分页：按用户查 + 倒序
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- 未读计数：部分索引只索引未读行（WHERE read_at IS NULL）
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- source_type 受控枚举：扩展时加值
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_source_type
    CHECK (source_type IN ('subscription_failed', 'friendlink_applied', 'comment_approved'));
