-- 反向：恢复删除的权限点

-- song menu 分组节点
INSERT INTO permissions (code, name, type, parent_id, sort, is_builtin) VALUES
    ('song', '歌曲', 'menu', NULL, 6, TRUE)
ON CONFLICT (code) DO NOTHING;

-- song action 权限点
INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('song:upload', '上传歌曲', NULL, 'action', TRUE),
    ('song:update', '编辑歌曲元数据', NULL, 'action', TRUE),
    ('song:delete', '删除歌曲', NULL, 'action', TRUE),
    ('song:fetch-meta', '获取歌词/封面', NULL, 'action', TRUE),
    ('user:assign-superadmin', '授予超管权限', NULL, 'action', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 挂 song action 到 song menu
UPDATE permissions p SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'song'
  AND p.type = 'action' AND p.code LIKE 'song:%';

-- 恢复 admin 角色的 song:* 关联
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code LIKE 'song:%'
ON CONFLICT DO NOTHING;
