-- 079 down: 回退到 078 原始三值约束
-- 注意回退后 subscription_succeeded 通知将无法落库。

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_source_type;

ALTER TABLE notifications ADD CONSTRAINT chk_notifications_source_type
    CHECK (source_type IN ('subscription_failed', 'friendlink_applied', 'comment_approved'));
