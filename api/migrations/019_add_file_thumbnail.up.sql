-- 为 files 表添加缩略图字段
ALTER TABLE files ADD COLUMN IF NOT EXISTS thumbnail VARCHAR(500) DEFAULT NULL;

COMMENT ON COLUMN files.thumbnail IS '缩略图 URL';
