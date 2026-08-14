-- 082: notifications source_type 增加 comment_pending（评论待审通知管理员）
-- 约束值清单与 domain/notification/entity.go 的 validSourceTypes 同步。

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_source_type;

ALTER TABLE notifications ADD CONSTRAINT chk_notifications_source_type
    CHECK (source_type IN (
        'subscription_failed',
        'subscription_succeeded',
        'friendlink_applied',
        'friendlink_reviewed',
        'comment_approved',
        'comment_created',
        'comment_pending',
        'comment_rejected',
        'user_registered',
        'account_security'
    ));
