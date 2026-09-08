DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE code IN ('persona:view', 'persona:manage')
);

DELETE FROM permissions WHERE code IN ('persona:view', 'persona:manage');
DELETE FROM permissions WHERE code = 'persona' AND type = 'menu';
