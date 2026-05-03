-- 回滚：删除表情相关表
DROP TABLE IF EXISTS emojis;
DROP TABLE IF EXISTS emoji_groups;

-- 注意：旧的 sticker 表结构已丢失，如需恢复请参考 010_create_stickers.up.sql