-- 075: tweet_comments 加评论附图（与文章评论 028 同构，PRD-0013）
-- 推文评论支持表情与图片：pictures 存 Bilibili 式附图元数据，body 中的 [name] 占位符
-- 由应用层查表富化 emote 映射渲染（纯数据列，无关联表）。

ALTER TABLE tweet_comments ADD COLUMN IF NOT EXISTS pictures JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN tweet_comments.pictures IS '评论图片数组，格式：[{"url": "...", "width": 736, "height": 736, "size": 63.165}]';
