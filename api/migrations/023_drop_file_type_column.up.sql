-- 删除 files 表中残留的 file_type 列（已被 purpose 替代）
ALTER TABLE files DROP COLUMN IF EXISTS file_type;
