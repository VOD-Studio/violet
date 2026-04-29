-- 删除图片表
DROP TABLE IF EXISTS images;

-- 删除默认站点设置项
DELETE FROM site_settings WHERE key IN (
    'site_name', 'site_description', 'site_url', 'admin_email',
    'posts_per_page', 'comments_enabled', 'comments_moderation',
    'github_username', 'footer_text'
);
