-- 回缩 CHECK 约束前先清理存量公告通知行
DELETE FROM notifications WHERE source_type = 'announcement';
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_source_type;
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_source_type
    CHECK (source_type IN (
        'subscription_failed', 'subscription_succeeded',
        'friendlink_applied', 'friendlink_reviewed',
        'comment_approved', 'comment_created', 'comment_pending', 'comment_rejected',
        'user_registered', 'account_security', 'chat_room_invited',
        'tweet_liked', 'tweet_quoted', 'tweet_commented', 'tweet_comment_replied',
        'window_knocked'
    ));
