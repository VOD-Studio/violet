-- 081 down: 回退到 079 后的四值约束

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_source_type;

ALTER TABLE notifications ADD CONSTRAINT chk_notifications_source_type
    CHECK (source_type IN ('subscription_failed', 'subscription_succeeded', 'friendlink_applied', 'comment_approved'));
