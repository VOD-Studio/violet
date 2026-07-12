-- 权限矩阵重构：每个模块新增 view 权限点，控制菜单/页面可见性
-- 设计：view = 能进页面看列表（只读全部数据），操作权限（create/update/delete）控制按钮

-- ============================================================
-- 1. 新增 10 个 view 权限点（post/comment/tag/media/playlist/emoji/project/user/role/announcement）
-- ============================================================
INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('post:view',         '查看文章管理',   '文章管理页可见，查看文章列表',         'action', TRUE),
    ('comment:view',      '查看评论审核',   '评论审核页可见，查看评论列表',         'action', TRUE),
    ('tag:view',          '查看标签管理',   '标签管理页可见，查看标签列表',         'action', TRUE),
    ('media:view',        '查看素材管理',   '素材管理页可见，查看素材列表',         'action', TRUE),
    ('playlist:view',     '查看歌单管理',   '歌单管理页可见，查看歌单列表',         'action', TRUE),
    ('emoji:view',        '查看表情管理',   '表情管理页可见，查看表情列表',         'action', TRUE),
    ('project:view',      '查看项目管理',   '项目管理页可见，查看项目列表',         'action', TRUE),
    ('user:view',         '查看用户管理',   '用户管理页可见，查看用户列表',         'action', TRUE),
    ('role:view',         '查看角色管理',   '角色管理页可见，查看角色列表',         'action', TRUE),
    ('announcement:view', '查看公告管理',   '公告管理页可见，查看公告列表',         'action', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. user:list 改名为 user:view（语义统一：页面可见 + 列表查询）
-- ============================================================
UPDATE permissions SET code = 'user:view', name = '查看用户管理', description = '用户管理页可见，查看用户列表'
WHERE code = 'user:list' AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'user:view');
-- 若 user:view 已由上方 INSERT 创建（重跑场景），删掉旧 user:list
DELETE FROM role_permissions WHERE permission_id = (SELECT id FROM permissions WHERE code = 'user:list');
DELETE FROM permissions WHERE code = 'user:list';

-- ============================================================
-- 3. view 权限挂到对应 menu 分组下
-- ============================================================
UPDATE permissions p SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu'
  AND p.type = 'action'
  AND p.code LIKE '%:view'
  AND m.code = split_part(p.code, ':', 1)
  AND p.parent_id IS NULL;

-- ============================================================
-- 4. seed view 权限给对应角色
-- ============================================================
-- admin 拥有全部 view 权限（管理全模块）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code LIKE '%:view'
ON CONFLICT DO NOTHING;

-- author 拥有 post:view + media:view（只能进文章管理和素材管理）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'author' AND p.code IN ('post:view', 'media:view')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. 从 author 移除 post:update（作者编辑自己的文章靠所有权放行，不需要操作权限码）
-- ============================================================
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'author')
  AND permission_id = (SELECT id FROM permissions WHERE code = 'post:update');
