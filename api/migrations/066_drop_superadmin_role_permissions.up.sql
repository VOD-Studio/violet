-- superadmin 角色的权限改为固有语义（代码层通配短路），不再依赖 role_permissions 表。
-- 清空其历史权限关联：避免表中残留记录误导界面以为 superadmin 可配置。
-- root 用户与被委派超管的权限判断均走 Checker 的角色名短路，与表内容无关。
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'superadmin');
