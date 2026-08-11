-- 回滚：移除 tweet_comments.pictures 列
ALTER TABLE tweet_comments DROP COLUMN IF EXISTS pictures;
