-- 反向：移除 system:view 与 log:view 权限点及其关联
DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('system:view', 'log:view'));

DELETE FROM permissions WHERE code IN ('system:view', 'log:view');
