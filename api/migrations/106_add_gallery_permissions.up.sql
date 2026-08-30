-- 106: 图集工作稿管理权限（issue #282）

INSERT INTO permissions (code, name, type, parent_id, sort, is_builtin) VALUES
    ('gallery', '图集', 'menu', NULL, 17, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('gallery:view',   '查看图集管理', '图集管理入口、作者自己的工作稿列表与详情', 'action', TRUE),
    ('gallery:manage', '管理图集工作稿', '创建并完整保存作者自己的图集工作稿',       'action', TRUE)
ON CONFLICT (code) DO NOTHING;

UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'gallery'
  AND p.code IN ('gallery:view', 'gallery:manage');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code IN ('gallery:view', 'gallery:manage')
ON CONFLICT DO NOTHING;
