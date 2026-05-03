-- 为 emojis 表添加 source_url 字段，存储原始来源 URL
ALTER TABLE emojis ADD COLUMN source_url VARCHAR(500) DEFAULT NULL;

COMMENT ON COLUMN emojis.source_url IS '原始来源URL（如B站CDN地址）';

-- 更新现有数据：将 url 中包含 hdslb.com 的移动到 source_url
UPDATE emojis SET source_url = url WHERE url LIKE '%hdslb.com%';