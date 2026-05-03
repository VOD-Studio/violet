-- 恢复 file_type 列
ALTER TABLE files ADD COLUMN file_type VARCHAR(20) NOT NULL DEFAULT 'material';
