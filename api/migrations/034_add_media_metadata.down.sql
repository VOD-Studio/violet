-- 034 回滚：移除 files 表的素材元数据字段
ALTER TABLE files DROP COLUMN IF EXISTS alt_text;
ALTER TABLE files DROP COLUMN IF EXISTS category;
