-- 将 file_hash 列从 CHAR(32)（MD5）扩展为 VARCHAR(64)（SHA-256）
-- 前端使用 SHA-256 采样哈希，长度为 64 字符

ALTER TABLE files ALTER COLUMN file_hash TYPE VARCHAR(64);
ALTER TABLE upload_sessions ALTER COLUMN file_hash TYPE VARCHAR(64);

COMMENT ON COLUMN files.file_hash IS '文件哈希（SHA-256），用于秒传去重';
COMMENT ON COLUMN upload_sessions.file_hash IS '文件哈希（SHA-256），用于秒传和校验';
