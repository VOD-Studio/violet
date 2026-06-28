-- 034: 为 files 表增加素材元数据字段（alt_text / category）
-- 支持「素材管理」功能的描述与自定义分类，与系统 purpose 分类正交。

-- alt_text: 图片替代文本/素材描述（无障碍 + SEO），默认空串
ALTER TABLE files ADD COLUMN alt_text VARCHAR(500) NOT NULL DEFAULT '';

-- category: 用户自定义分类（如" banner"、"截图"），默认空串
ALTER TABLE files ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT '';
