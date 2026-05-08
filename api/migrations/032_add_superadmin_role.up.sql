-- 将 superadmin 角色纳入 RBAC 体系
INSERT INTO roles (name, description) VALUES ('superadmin', '超级管理员')
ON CONFLICT (name) DO NOTHING;

-- 超级管理员拥有所有权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'superadmin'
ON CONFLICT DO NOTHING;

-- 修正现有超级管理员用户的 role_id
UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'superadmin')
WHERE role = 'superadmin'
  AND role_id IS DISTINCT FROM (SELECT id FROM roles WHERE name = 'superadmin');
