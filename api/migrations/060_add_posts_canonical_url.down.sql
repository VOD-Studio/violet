-- 060 down: 回滚 posts.canonical_url 列

ALTER TABLE posts DROP COLUMN IF EXISTS canonical_url;
