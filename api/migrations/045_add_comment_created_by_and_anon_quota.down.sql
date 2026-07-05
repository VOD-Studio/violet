-- 回滚 045_add_comment_created_by_and_anon_quota

DROP INDEX IF EXISTS idx_comments_anon_quota;
ALTER TABLE comments DROP COLUMN IF EXISTS created_by;
