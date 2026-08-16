-- 080: notifications 表补齐 event_id 列与幂等唯一约束
-- e8361136 曾原地修改 078（加列/唯一约束/约束值），已应用旧版 078 的库不会
-- 重放该修改。079 已补约束值，本迁移补齐剩余两项。全新库（当前 078 已含
-- 这些结构）执行本迁移幂等无害。

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id UUID;

-- 存量行回填随机 event_id：仅为满足 NOT NULL 与唯一约束，事件本体已不可考
UPDATE notifications SET event_id = gen_random_uuid() WHERE event_id IS NULL;

ALTER TABLE notifications ALTER COLUMN event_id SET NOT NULL;

-- 幂等：同一领域事件给同一接收者只写一行（Save 用 ON CONFLICT DO NOTHING）
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS uq_notifications_event_user;
ALTER TABLE notifications ADD CONSTRAINT uq_notifications_event_user UNIQUE (event_id, user_id);
