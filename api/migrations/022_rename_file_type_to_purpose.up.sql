-- 重命名 files 表的 file_type 为 purpose
ALTER TABLE files RENAME COLUMN file_type TO purpose;

-- 为 upload_sessions 表添加 purpose 列（AutoMigrate 也会处理，但显式迁移更安全）
ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) NOT NULL DEFAULT 'material';
