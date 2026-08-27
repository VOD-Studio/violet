-- 回滚前把 chat_message 通知物理删除，否则 CHECK 回缩后存量行非法
DELETE FROM notifications WHERE source_type = 'chat_message';
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_source_type;
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_source_type
    CHECK (source_type IN (
        'subscription_failed', 'subscription_succeeded',
        'friendlink_applied', 'friendlink_reviewed',
        'comment_approved', 'comment_created', 'comment_pending', 'comment_rejected',
        'user_registered', 'account_security', 'chat_room_invited'
    ));
