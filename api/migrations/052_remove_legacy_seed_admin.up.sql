-- 删除 006 迁移种入的旧默认管理员账号
-- 背景：按「仅 superadmin 走配置」决策，admin/author 用户由内置超管在后台手动创建，
-- 不再预置默认管理员。superadmin 仍由启动配置注入（ensure_super_admin）。
--
-- 注意：posts/stickers 等表对 users 为 ON DELETE CASCADE，删除该账号会级联删除其文章与贴纸。
-- 该账号仅作为开发/演示种子存在，生产环境若已被真实使用请先迁移其数据。
-- 精确匹配 email+username，避免误删同邮箱的真实账号。
DELETE FROM users
WHERE email = 'admin@gmail.com' AND username = 'admin';
