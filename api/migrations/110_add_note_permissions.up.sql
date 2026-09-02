-- 110: 笔记管理权限（issue #296）

INSERT INTO permissions (code, name, type, parent_id, sort, is_builtin) VALUES
    ('note', '笔记', 'menu', NULL, 18, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('note:view',   '查看笔记管理', '笔记管理入口、笔记列表与详情', 'action', TRUE),
    ('note:manage', '管理笔记',     '创建、编辑、发布与删除笔记',   'action', TRUE)
ON CONFLICT (code) DO NOTHING;

UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'note'
  AND p.code IN ('note:view', 'note:manage');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code IN ('note:view', 'note:manage')
ON CONFLICT DO NOTHING;
