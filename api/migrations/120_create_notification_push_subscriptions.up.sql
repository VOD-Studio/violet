-- 站内通知的浏览器 Web Push 订阅（与 chat_push_subscriptions 相互独立：
-- 「接收聊天提醒」与「接收站内通知提醒」是两次独立的用户授权）
CREATE TABLE notification_push_subscriptions (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT PRIMARY KEY,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_push_subscriptions_user ON notification_push_subscriptions(user_id);
