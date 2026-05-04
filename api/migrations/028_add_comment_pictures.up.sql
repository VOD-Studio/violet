-- 添加评论图片支持
-- 参考 Bilibili：评论可以包含多张图片

ALTER TABLE comments ADD COLUMN IF NOT EXISTS pictures JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN comments.pictures IS '评论图片数组，格式：[{"url": "...", "width": 736, "height": 736, "size": 63.165}]';
