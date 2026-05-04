-- 回滚：移除评论图片字段
ALTER TABLE comments DROP COLUMN IF EXISTS pictures;
