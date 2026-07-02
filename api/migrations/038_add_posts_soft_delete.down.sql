-- 回滚软删除
DROP INDEX IF EXISTS idx_posts_slug_active;
ALTER TABLE posts ADD CONSTRAINT posts_slug_key UNIQUE (slug);
DROP INDEX IF EXISTS idx_posts_deleted_at;
ALTER TABLE posts DROP COLUMN deleted_at;
