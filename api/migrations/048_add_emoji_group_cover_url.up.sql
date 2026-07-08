-- 为 emoji_groups 添加 cover_url 字段，存储分组封面图 URL
ALTER TABLE emoji_groups ADD COLUMN cover_url VARCHAR(500) DEFAULT NULL;

COMMENT ON COLUMN emoji_groups.cover_url IS '分组封面图 URL（如 B站表情包封面）';
