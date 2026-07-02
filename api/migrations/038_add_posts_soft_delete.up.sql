-- 文章软删除：deleted_at 字段 + 部分索引
ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX idx_posts_deleted_at ON posts(deleted_at) WHERE deleted_at IS NULL;

-- slug 唯一约束改为「未删除时唯一」，允许软删除后以同 slug 重建文章。
-- 同时清理 GORM AutoMigrate(unique tag) 可能创建的全表唯一索引，避免其继续阻止 slug 复用。
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_slug_key;
DROP INDEX IF EXISTS uni_posts_slug;
CREATE UNIQUE INDEX idx_posts_slug_active ON posts(slug) WHERE deleted_at IS NULL;
