-- 回滚：删除 gif_url 字段
ALTER TABLE emojis DROP COLUMN IF EXISTS gif_url;
