-- 076 down: 回滚 friendlinks 表与 friendlink 权限

DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('friendlink:view', 'friendlink:manage'));

DELETE FROM permissions WHERE code IN ('friendlink:view', 'friendlink:manage');
DELETE FROM permissions WHERE code = 'friendlink' AND type = 'menu';

DROP TABLE IF EXISTS friendlinks;
