-- 082 down: 回退到 081 后的九值约束

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_source_type;

ALTER TABLE notifications ADD CONSTRAINT chk_notifications_source_type
    CHECK (source_type IN (
        'subscription_failed',
        'subscription_succeeded',
        'friendlink_applied',
        'friendlink_reviewed',
        'comment_approved',
        'comment_created',
        'comment_rejected',
        'user_registered',
        'account_security'
    ));
