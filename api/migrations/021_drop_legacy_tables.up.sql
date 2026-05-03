-- 删除旧的 images、media、upload_chunks 表（已迁移到 files + upload_sessions）
DROP TABLE IF EXISTS upload_chunks;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS images;
