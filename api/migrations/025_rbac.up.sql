-- RBAC 权限系统
-- 角色表
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 权限表
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 角色-权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 种子数据：默认角色
INSERT INTO roles (name, description) VALUES
    ('admin', '管理员'),
    ('editor', '编辑'),
    ('user', '普通用户')
ON CONFLICT (name) DO NOTHING;

-- 种子数据：所有权限点
INSERT INTO permissions (code, name) VALUES
    ('post:create', '创建文章'),
    ('post:update', '编辑文章'),
    ('post:delete', '删除文章'),
    ('post:publish', '发布/取消发布文章'),
    ('comment:delete', '删除评论'),
    ('comment:approve', '审核评论'),
    ('tag:create', '创建标签'),
    ('tag:update', '编辑标签'),
    ('tag:delete', '删除标签'),
    ('media:upload', '上传媒体文件'),
    ('media:delete', '删除媒体文件'),
    ('playlist:create', '创建歌单'),
    ('playlist:update', '编辑歌单'),
    ('playlist:delete', '删除歌单'),
    ('playlist:toggle', '启用/禁用歌单'),
    ('song:upload', '上传歌曲'),
    ('song:update', '编辑歌曲元数据'),
    ('song:delete', '删除歌曲'),
    ('song:fetch-meta', '获取歌词/封面'),
    ('emoji:create', '上传表情'),
    ('emoji:delete', '删除表情'),
    ('emoji:manage-group', '管理表情分组'),
    ('user:list', '查看用户列表'),
    ('user:update-role', '修改用户角色'),
    ('user:ban', '封禁/解封用户'),
    ('project:create', '创建项目'),
    ('project:update', '编辑项目'),
    ('project:delete', '删除项目'),
    ('settings:view', '查看系统设置'),
    ('settings:update', '修改系统设置'),
    ('role:manage', '管理角色权限')
ON CONFLICT (code) DO NOTHING;

-- admin 角色拥有所有权限
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- users 表新增 role_id 外键
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INT REFERENCES roles(id);

-- 迁移现有用户：将 role 字符串映射到 role_id
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = users.role) WHERE role_id IS NULL AND role IN ('user', 'admin', 'superadmin');

-- 未匹配的默认为普通用户
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'user') WHERE role_id IS NULL;
