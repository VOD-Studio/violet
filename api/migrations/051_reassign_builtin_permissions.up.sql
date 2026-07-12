-- 重新分配内置角色的默认权限
-- 权限矩阵（见 ADR / PR 描述）：
--   superadmin = 全部权限（被委派超管兜底；内置超管靠 is_builtin_super_admin 标志位通配短路）
--   admin      = 除 role:manage 和 user:assign-superadmin 外的全部
--   author     = admin:access + post:create + post:update + media:upload
--   user       = 无管理权限（保持现状，不动）

-- ============================================================
-- admin：全量替换为「除 role:manage 和 user:assign-superadmin 外的全部权限」
-- ============================================================
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'admin');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.code NOT IN ('role:manage', 'user:assign-superadmin')
ON CONFLICT DO NOTHING;

-- ============================================================
-- author：仅授予内容创作相关权限
-- ============================================================
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'author');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'author'
  AND p.code IN ('admin:access', 'post:create', 'post:update', 'media:upload')
ON CONFLICT DO NOTHING;
