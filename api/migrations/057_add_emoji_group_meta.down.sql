-- 回滚：删除 meta 字段
ALTER TABLE emoji_groups DROP COLUMN IF EXISTS meta;
