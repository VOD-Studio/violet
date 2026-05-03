-- 回滚：将 purpose 重命名回 file_type
ALTER TABLE files RENAME COLUMN purpose TO file_type;
ALTER TABLE upload_sessions DROP COLUMN IF EXISTS purpose;
