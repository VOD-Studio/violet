-- 反向：移除新增的 view 权限点，恢复 user:list

-- 恢复 author 的 post:update
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'author' AND p.code = 'post:update'
ON CONFLICT DO NOTHING;

-- 移除 author 的 post:view + media:view
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'author')
  AND permission_id IN (SELECT id FROM permissions WHERE code IN ('post:view', 'media:view'));

-- 移除 admin 的 view 权限关联（仅本轮新增的 10 个）
DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE code IN ('post:view','comment:view','tag:view','media:view','playlist:view',
                   'emoji:view','project:view','user:view','role:view','announcement:view')
);

-- user:view 恢复为 user:list
UPDATE permissions SET code = 'user:list', name = '查看用户列表', description = NULL
WHERE code = 'user:view';

-- 删除本轮新增的 view 权限点（user:view 已在上行改名为 user:list，不含它）
DELETE FROM permissions
WHERE code IN ('post:view','comment:view','tag:view','media:view','playlist:view',
               'emoji:view','project:view','role:view','announcement:view');
