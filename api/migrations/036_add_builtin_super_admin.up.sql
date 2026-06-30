-- 内置超管标志位：区分"内置超管"（通配符权限，靠标志位短路）与"被委派超管"（按 role_permissions 表授权）
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_builtin_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 把现有匹配 superadmin 配置邮箱的用户置为内置超管（幂等，后续由 EnsureSuperAdmin 校正）
-- 此处不做硬编码邮箱假设，留待应用层启动时 EnsureSuperAdmin 置位。
