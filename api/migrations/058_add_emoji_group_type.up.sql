-- 为 emoji_groups 表添加 type 字段，区分文字组（颜文字）与图片组
-- 1=文字（颜文字组），2=图片；旧数据默认 2（图片）
ALTER TABLE emoji_groups ADD COLUMN type SMALLINT NOT NULL DEFAULT 2;

COMMENT ON COLUMN emoji_groups.type IS '分组类型：1=文字（颜文字组）2=图片';
