-- 删除死码权限点：song:*（歌曲操作仅超管，走 SuperAdminRequired 不用权限码）
-- 和 user:assign-superadmin（实际靠应用层 isBuiltinSuperAdmin 标志位）

-- 先删 role_permissions 关联
DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE code IN ('song:upload', 'song:update', 'song:delete', 'song:fetch-meta',
                   'user:assign-superadmin')
);

-- 删 song menu 分组节点（其下 action 已删，menu 也没用了）
DELETE FROM permissions
WHERE code = 'song' AND type = 'menu';

-- 删权限点本身
DELETE FROM permissions
WHERE code IN ('song:upload', 'song:update', 'song:delete', 'song:fetch-meta',
               'user:assign-superadmin');
