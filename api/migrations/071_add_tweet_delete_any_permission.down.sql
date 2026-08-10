-- 067 down: 回滚 tweet 权限

DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE code = 'tweet:delete-any');

DELETE FROM permissions WHERE code = 'tweet:delete-any';
DELETE FROM permissions WHERE code = 'tweet' AND type = 'menu';
