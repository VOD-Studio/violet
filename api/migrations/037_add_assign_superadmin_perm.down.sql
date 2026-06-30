DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE code = 'user:assign-superadmin');
DELETE FROM permissions WHERE code = 'user:assign-superadmin';
