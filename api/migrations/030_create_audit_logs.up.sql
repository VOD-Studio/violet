-- 操作日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(50),  -- 用户名（冗余存储，防止用户删除后无法追溯）
    action VARCHAR(50) NOT NULL,  -- 操作类型：create/update/delete/approve/ban 等
    resource_type VARCHAR(50) NOT NULL,  -- 资源类型：post/comment/user/role/setting 等
    resource_id VARCHAR(100),  -- 资源 ID
    resource_name VARCHAR(255),  -- 资源名称（如文章标题、用户名等）
    detail TEXT,  -- 操作详情（JSON 格式）
    ip_address VARCHAR(45),  -- 操作者 IP
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引优化查询
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 预定义操作类型
-- create: 创建资源
-- update: 更新资源
-- delete: 删除资源
-- approve: 审核通过
-- reject: 审核拒绝
-- ban: 封禁用户
-- unban: 解封用户
-- publish: 发布文章
-- unpublish: 取消发布
-- assign_role: 分配角色
-- update_permissions: 更新权限
-- login: 用户登录
-- logout: 用户登出