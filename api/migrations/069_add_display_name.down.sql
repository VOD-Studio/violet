-- 回滚：删除 display_name 列
ALTER TABLE users DROP COLUMN IF EXISTS display_name;
