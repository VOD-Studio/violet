-- 回滚：删除 type 字段
ALTER TABLE emoji_groups DROP COLUMN IF EXISTS type;
