-- 080 down: 回退 event_id 列与幂等唯一约束

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS uq_notifications_event_user;

ALTER TABLE notifications DROP COLUMN IF EXISTS event_id;
