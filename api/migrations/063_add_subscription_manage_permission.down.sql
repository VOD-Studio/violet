-- 063 down: 回滚 subscription:manage 权限点

DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE code = 'subscription:manage');
DELETE FROM permissions WHERE code = 'subscription:manage';
