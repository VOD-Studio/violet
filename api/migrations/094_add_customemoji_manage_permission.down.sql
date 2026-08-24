DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE code = 'customemoji:manage');

DELETE FROM permissions WHERE code = 'customemoji:manage';
