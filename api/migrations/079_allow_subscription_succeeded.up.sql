-- 079: notifications source_type 约束补上 subscription_succeeded
-- 078 落库后曾在 e8361136 被原地修改（三值→四值），已应用旧版 078 的库
-- 不会重放该修改，约束仍是三值：手动抓取成功的通知 INSERT 被 CHECK
-- 拒绝且仅记日志（抓取本身不受影响）。已发布迁移不可变更，此处显式重建。
-- DROP IF EXISTS：全新库应用当前 078（四值）后本迁移重建同名约束，幂等。

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_source_type;

ALTER TABLE notifications ADD CONSTRAINT chk_notifications_source_type
    CHECK (source_type IN ('subscription_failed', 'subscription_succeeded', 'friendlink_applied', 'comment_approved'));
