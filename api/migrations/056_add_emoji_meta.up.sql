-- 为 emojis 表添加 meta 字段，存储 B站表情的只读元数据
-- 含 alias（别名，用于搜索）、size（尺寸 1=小 2=大）、type（门槛 1=普通 2=会员 3=购买 4=颜文字）
ALTER TABLE emojis ADD COLUMN meta JSONB DEFAULT NULL;

COMMENT ON COLUMN emojis.meta IS '表情元数据 JSONB（alias/size/type，源自 B站 meta 子对象与顶层 type）';
