-- 下线歌单功能；保留 playlists、music_settings 及历史用户数据。
-- 先回收权限点的角色关联。
DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE code IN ('playlist:view', 'playlist:create', 'playlist:update', 'playlist:delete', 'playlist:toggle')
);

-- 先解除待删除权限点的父节点，避免删除菜单时级联删除其他权限。
UPDATE permissions SET parent_id = NULL
WHERE code IN ('playlist:view', 'playlist:create', 'playlist:update', 'playlist:delete', 'playlist:toggle');

-- 仅回收孤立菜单的角色关联；有其他子节点时保留该菜单及其授权。
DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT menu.id FROM permissions menu
    WHERE menu.code = 'playlist' AND menu.type = 'menu'
      AND NOT EXISTS (SELECT 1 FROM permissions child WHERE child.parent_id = menu.id)
);

DELETE FROM permissions menu
WHERE menu.code = 'playlist' AND menu.type = 'menu'
  AND NOT EXISTS (SELECT 1 FROM permissions child WHERE child.parent_id = menu.id);

DELETE FROM permissions
WHERE code IN ('playlist:view', 'playlist:create', 'playlist:update', 'playlist:delete', 'playlist:toggle');
