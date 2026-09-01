-- 108: 图集审核权限(issue #286)
-- gallery:view 语义随治理范围扩展:从「作者自己的工作稿」放宽为整个管理列表与工作稿详情,
-- 写操作边界由 gallery:manage(自己的稿)与 gallery:moderate(处置他人作品)在应用层判定。

UPDATE permissions
SET description = '图集管理入口、图集管理列表与工作稿详情'
WHERE code = 'gallery:view' AND is_builtin = TRUE;

INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('gallery:moderate', '审核图集', '撤回或删除其他作者的图集，不能替作者修改工作稿', 'action', TRUE)
ON CONFLICT (code) DO NOTHING;

UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'gallery'
  AND p.code = 'gallery:moderate';

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code = 'gallery:moderate'
ON CONFLICT DO NOTHING;
