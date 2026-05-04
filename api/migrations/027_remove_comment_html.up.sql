-- 重构评论表：移除 Markdown 支持，只存储纯文本
-- 参考 Bilibili：只存储纯文本 + 表情语法，前端渲染时替换表情

ALTER TABLE comments DROP COLUMN IF EXISTS body_md;
ALTER TABLE comments DROP COLUMN IF EXISTS body_html;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
