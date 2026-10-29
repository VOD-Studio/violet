DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('presence:view','presence:manage'));
DELETE FROM permissions WHERE code IN ('presence:view','presence:manage');
DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code='presence' AND type='menu' AND NOT EXISTS (SELECT 1 FROM permissions child WHERE child.parent_id=permissions.id));
DELETE FROM permissions p WHERE code='presence' AND type='menu' AND NOT EXISTS (SELECT 1 FROM permissions child WHERE child.parent_id=p.id);
DROP TABLE presence_settings;
DROP TABLE presence_devices;
