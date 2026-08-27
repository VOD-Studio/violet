DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('gallery:view', 'gallery:delete-any'));

DELETE FROM permissions WHERE code IN ('gallery:view', 'gallery:delete-any');
DELETE FROM permissions WHERE code = 'gallery' AND type = 'menu';
