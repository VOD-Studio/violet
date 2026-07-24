-- 为 emoji_groups 表添加 meta 字段，存储 B站表情包的分组级元数据
-- 当前仅 size（picker 渲染尺寸：1=小 2=大）有实际用途
ALTER TABLE emoji_groups ADD COLUMN meta JSONB DEFAULT NULL;

COMMENT ON COLUMN emoji_groups.meta IS '分组元数据 JSONB（size，源自 B站 package.meta.size，用于 picker 渲染）';
