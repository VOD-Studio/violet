-- 063: 新增 subscription:manage 权限点（后台订阅管理）
-- 订阅 CRUD + 暂停/恢复需此权限（T9 后台订阅管理页）。
-- 复用 mcp:manage-tokens 的 seed 模式（migration 059）。

-- 新增 subscription:manage 权限点
INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('subscription:manage', '管理 RSS 订阅', '创建/编辑/删除/暂停/恢复 RSS 订阅源', 'action', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 挂到 admin（系统）menu 分组下（同 mcp:manage-tokens）
UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'admin'
  AND p.code = 'subscription:manage';

-- seed 给 admin 角色（superadmin 靠 is_builtin_super_admin 通配短路）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code = 'subscription:manage'
ON CONFLICT DO NOTHING;
