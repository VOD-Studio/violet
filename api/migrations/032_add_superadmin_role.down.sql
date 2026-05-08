-- 回滚：移除超级管理员的角色-权限关联和角色记录
DELETE FROM role_permissions WHERE role_id = (SELECT id FROM roles WHERE name = 'superadmin');
DELETE FROM roles WHERE name = 'superadmin';

-- 将超级管理员用户的 role_id 重置为普通用户
UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'user')
WHERE role = 'superadmin';
