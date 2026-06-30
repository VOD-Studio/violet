-- 新增"授予超管权限"权限点
-- 注意：此权限点不 seed 给任何角色（superadmin 角色也不挂）。
-- 内置超管靠 JWT 的 is_builtin_super_admin 标志位短路自动拥有；被委派超管不应拥有 → 授权链不可传递。
INSERT INTO permissions (code, name, type, is_builtin) VALUES ('user:assign-superadmin', '授予超管权限', 'action', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 挂到 user menu 分组下
UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'user' AND p.code = 'user:assign-superadmin';
