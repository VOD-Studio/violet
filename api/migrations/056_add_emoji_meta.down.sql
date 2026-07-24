-- 回滚：删除 meta 字段
ALTER TABLE emojis DROP COLUMN IF EXISTS meta;
