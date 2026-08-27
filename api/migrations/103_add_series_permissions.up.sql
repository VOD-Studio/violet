-- 103: series 权限（PRD-0021 / issue #260）
-- 权限模型对齐 post 域（书管理是文章管理的延伸）：
--   series:view   书管理页可见
--   series:create 建书
--   series:update 改书/建卷/挂章/调序（叠加 owner 校验）
--   series:delete 解散书（叠加 owner 校验）

INSERT INTO permissions (code, name, type, parent_id, sort, is_builtin) VALUES
    ('series', '系列书', 'menu', NULL, 16, TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('series:view',   '查看系列书', '系列书管理页可见，查看书列表与目录', 'action', TRUE),
    ('series:create', '创建系列书', '新建书（draft 起步，挂章后发布）',     'action', TRUE),
    ('series:update', '管理系列书', '编辑书、建卷、挂章/摘章、章节调序（限自己的书）', 'action', TRUE),
    ('series:delete', '解散系列书', '解散书（解绑全部章节，不删文章；限自己的书）',   'action', TRUE)
ON CONFLICT (code) DO NOTHING;

UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'series'
  AND p.code IN ('series:view', 'series:create', 'series:update', 'series:delete');

-- seed 给 admin 角色（superadmin 靠 is_root 通配短路）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code IN ('series:view', 'series:create', 'series:update', 'series:delete')
ON CONFLICT DO NOTHING;
