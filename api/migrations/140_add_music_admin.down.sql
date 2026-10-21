DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('music:view','music:manage'));
DELETE FROM permissions WHERE code IN ('music:view','music:manage');
DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code='music' AND type='menu' AND NOT EXISTS (SELECT 1 FROM permissions child WHERE child.parent_id=permissions.id));
DELETE FROM permissions p WHERE code='music' AND type='menu' AND NOT EXISTS (SELECT 1 FROM permissions child WHERE child.parent_id=p.id);
DROP TABLE music_featured_playlists;
DROP TABLE music_login_challenges;
DROP TABLE music_account;
