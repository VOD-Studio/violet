-- 110 down: 回滚笔记管理权限

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE code IN ('note:view', 'note:manage')
);

DELETE FROM permissions WHERE code IN ('note:view', 'note:manage');
DELETE FROM permissions WHERE code = 'note' AND type = 'menu';
