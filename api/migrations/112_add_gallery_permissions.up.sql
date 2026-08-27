-- 112: gallery 权限（PRD-0022 / issue #264）
-- 权限模型对齐 tweet 域（建/编/删自己的图集不需权限码，登录即可）：
--   gallery:view        图集管理页可见
--   gallery:delete-any  下架/恢复任意图集，物理删任意图集（治理动作）

INSERT INTO permissions (code, name, type, parent_id, sort, is_builtin) VALUES
    ('gallery', '图集', 'menu', NULL, 17, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('gallery:view',       '查看图集',   '图集管理页可见，查看全站图集列表',        'action', TRUE),
    ('gallery:delete-any', '治理图集',   '下架/恢复任意图集，删除任意图集（管理员治理）', 'action', TRUE)
ON CONFLICT (code) DO NOTHING;

UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'gallery'
  AND p.code IN ('gallery:view', 'gallery:delete-any');

-- seed 给 admin 角色（superadmin 靠 is_root 通配短路）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code IN ('gallery:view', 'gallery:delete-any')
ON CONFLICT DO NOTHING;
