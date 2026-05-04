-- 为 emojis 表添加 gif_url 字段，用于存储动图 URL
ALTER TABLE emojis ADD COLUMN gif_url VARCHAR(500) DEFAULT NULL;

COMMENT ON COLUMN emojis.gif_url IS '动图URL（GIF/APNG等动态表情）';

-- 说明字段用途：
-- url: 静态图 URL（PNG/JPG）
-- gif_url: 动图 URL（GIF/APNG）
-- source_url: 原始来源 URL（如 B站 CDN 地址）
