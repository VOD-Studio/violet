-- 仅恢复定义和默认 admin 授权，不恢复下线时回收的自定义角色授权。
INSERT INTO permissions (code, name, type, parent_id, sort, is_builtin) VALUES
    ('playlist', '歌单', 'menu', NULL, 5, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('playlist:view', '查看歌单管理', '歌单管理页可见，查看歌单列表', 'action', TRUE),
    ('playlist:create', '创建歌单', NULL, 'action', TRUE),
    ('playlist:update', '编辑歌单', NULL, 'action', TRUE),
    ('playlist:delete', '删除歌单', NULL, 'action', TRUE),
    ('playlist:toggle', '启用/禁用歌单', NULL, 'action', TRUE)
ON CONFLICT (code) DO NOTHING;

UPDATE permissions p SET parent_id = menu.id
FROM permissions menu
WHERE menu.code = 'playlist' AND menu.type = 'menu'
  AND p.code IN ('playlist:view', 'playlist:create', 'playlist:update', 'playlist:delete', 'playlist:toggle');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.code IN ('playlist:view', 'playlist:create', 'playlist:update', 'playlist:delete', 'playlist:toggle')
ON CONFLICT DO NOTHING;
