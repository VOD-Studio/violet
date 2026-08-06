-- 回滚：恢复 superadmin 角色的全部权限关联。
-- 与 032（初次 seed 全部权限）语义一致，但以当前 permissions 表为准。
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'superadmin'
ON CONFLICT DO NOTHING;
