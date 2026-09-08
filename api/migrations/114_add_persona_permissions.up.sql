INSERT INTO permissions (code, name, type, parent_id, sort, is_builtin) VALUES
    ('persona', '人设档案', 'menu', NULL, 19, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('persona:view',   '查看人设档案', '人设管理入口、档案列表与详情',       'action', TRUE),
    ('persona:manage', '管理人设档案', '创建、保存、激活与删除人设档案',     'action', TRUE)
ON CONFLICT (code) DO NOTHING;

UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'persona'
  AND p.code IN ('persona:view', 'persona:manage');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code IN ('persona:view', 'persona:manage')
ON CONFLICT DO NOTHING;
