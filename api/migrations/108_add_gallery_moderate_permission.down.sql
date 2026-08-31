-- 108 回滚:移除 gallery:moderate 权限并还原 gallery:view 描述。

DELETE FROM role_permissions
WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'gallery:moderate');

DELETE FROM permissions WHERE code = 'gallery:moderate' AND is_builtin = TRUE;

UPDATE permissions
SET description = '图集管理入口、作者自己的工作稿列表与详情'
WHERE code = 'gallery:view' AND is_builtin = TRUE;
