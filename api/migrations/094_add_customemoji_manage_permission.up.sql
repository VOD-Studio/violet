-- 094: 自定义表情管理权限（管理员强制下架任意用户的违规自定义表情）
INSERT INTO permissions (code, name)
VALUES ('customemoji:manage', '管理自定义表情')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.code = 'customemoji:manage'
ON CONFLICT DO NOTHING;
