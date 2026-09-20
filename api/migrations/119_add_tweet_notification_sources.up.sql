-- 站内通知来源新增推文互动四类：点赞/引用转发/收到评论/评论被回复
-- 约束值清单与 domain/notification/entity.go 的 validSourceTypes 同步。
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_source_type;
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_source_type
    CHECK (source_type IN (
        'subscription_failed', 'subscription_succeeded',
        'friendlink_applied', 'friendlink_reviewed',
        'comment_approved', 'comment_created', 'comment_pending', 'comment_rejected',
        'user_registered', 'account_security', 'chat_room_invited',
        'tweet_liked', 'tweet_quoted', 'tweet_commented', 'tweet_comment_replied'
    ));
