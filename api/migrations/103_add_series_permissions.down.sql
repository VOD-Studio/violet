DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('series:view', 'series:create', 'series:update', 'series:delete'));

DELETE FROM permissions WHERE code IN ('series:view', 'series:create', 'series:update', 'series:delete');
DELETE FROM permissions WHERE code = 'series' AND type = 'menu';
