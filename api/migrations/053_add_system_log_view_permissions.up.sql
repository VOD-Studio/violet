-- 新增 system:view（系统监控）与 log:view（操作日志）权限点
-- 这两类数据含敏感信息（主机配置/IP/操作明细），不再仅靠 admin:access 放行
INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('system:view', '查看系统监控', '查看主机/磁盘/运行时等系统指标', 'action', TRUE),
    ('log:view', '查看操作日志', '查看审计日志（含 IP 与操作明细）', 'action', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 挂到 admin（系统）menu 分组下
UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'admin'
  AND p.code IN ('system:view', 'log:view');

-- seed 给 admin 角色（superadmin 靠 is_builtin_super_admin 通配短路）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code IN ('system:view', 'log:view')
ON CONFLICT DO NOTHING;
