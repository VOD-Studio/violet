-- 反向：恢复 admin 全部权限、清空 author 权限（回到 051 之前的状态）
-- 注意：down 051 时 author 尚未被 050-down 还原为 editor，仍以 author 名称操作

-- admin 恢复为全部权限
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'admin');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- author 清空权限（editor 原本就无权限分配）
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'author');
