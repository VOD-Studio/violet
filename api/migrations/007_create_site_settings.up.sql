-- 插入默认站点设置项
-- site_settings 表已在 004 迁移中创建
INSERT INTO site_settings (key, value) VALUES
    ('site_name', 'My Blog'),
    ('site_description', 'A personal blog built with Go and Next.js'),
    ('site_url', 'http://localhost:3000'),
    ('admin_email', 'admin@gmail.com'),
    ('posts_per_page', '10'),
    ('comments_enabled', 'true'),
    ('comments_moderation', 'true'),
    ('github_username', ''),
    ('footer_text', '© 2026 My Blog. All rights reserved.')
ON CONFLICT (key) DO NOTHING;

-- 图片管理表
CREATE TABLE images (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename      VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    url           TEXT NOT NULL,
    mime_type     VARCHAR(100) NOT NULL,
    size          BIGINT NOT NULL DEFAULT 0,
    uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 按上传时间查询图片的索引
CREATE INDEX idx_images_created_at ON images(created_at DESC);

-- 按上传者查询图片的索引
CREATE INDEX idx_images_uploaded_by ON images(uploaded_by);
