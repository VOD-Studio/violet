-- 新增管理后台访问权限
INSERT INTO permissions (code, name) VALUES ('admin:access', '管理后台访问')
ON CONFLICT (code) DO NOTHING;

-- admin 和 superadmin 角色拥有此权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('admin', 'superadmin') AND p.code = 'admin:access'
ON CONFLICT DO NOTHING;
