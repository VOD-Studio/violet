-- 084: 站内通知支持私有房间邀请
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_source_type;
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_source_type
    CHECK (source_type IN (
        'subscription_failed', 'subscription_succeeded',
        'friendlink_applied', 'friendlink_reviewed',
        'comment_approved', 'comment_created', 'comment_pending', 'comment_rejected',
        'user_registered', 'account_security', 'chat_room_invited'
    ));
