INSERT INTO permissions (code, name, description, type, is_builtin)
VALUES ('system:manage', '管理系统面板', '执行 SQL、导出数据并管理数据库备份', 'action', TRUE)
ON CONFLICT (code) DO NOTHING;

UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu'
  AND m.code = 'admin'
  AND p.code = 'system:manage';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.code = 'system:manage'
ON CONFLICT DO NOTHING;
