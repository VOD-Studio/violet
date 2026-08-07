-- 067: 新增 tweet 权限（PRD-0013 / issue #101）
-- menu=tweet 分组 + action=tweet:delete-any（管理员删除任意推文）。
-- 发推文/删自己的推文/点赞不需要权限码，登录即可。
-- 复用 063 subscription:manage 的 seed 模式。

-- 新增 tweet menu 分组（sort 接续 035 的 admin=13）
INSERT INTO permissions (code, name, type, parent_id, sort, is_builtin) VALUES
    ('tweet', '推文', 'menu', NULL, 14, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 新增 tweet:delete-any 权限点
INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('tweet:delete-any', '删除任意推文', '删除任意用户的推文（前台时间线/详情页删除按钮）', 'action', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 挂到 tweet menu 分组下
UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'tweet'
  AND p.code = 'tweet:delete-any';

-- seed 给 admin 角色（superadmin 靠 is_builtin_super_admin 通配短路）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code = 'tweet:delete-any'
ON CONFLICT DO NOTHING;
