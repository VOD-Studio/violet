-- 059: PAT（个人访问令牌）表 + mcp:manage-tokens 权限点
-- PAT 供 AI agent 经 MCP 服务器鉴权，库中只存 token_hash（明文仅创建时返回）。

CREATE TABLE api_tokens (
    id           UUID         PRIMARY KEY,
    user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    token_hash   VARCHAR(64)  NOT NULL,
    scopes       JSONB        NOT NULL DEFAULT '[]',
    expires_at   TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- token_hash 唯一索引：鉴权时 O(1) 查找
CREATE UNIQUE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);
-- user_id 索引：列表查询
CREATE INDEX idx_api_tokens_user_id ON api_tokens(user_id);

-- 新增 mcp:manage-tokens 权限点（创建/吊销 PAT 需此权限）
INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('mcp:manage-tokens', '管理 MCP 访问令牌', '创建与吊销供 AI agent 使用的个人访问令牌', 'action', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 挂到 admin（系统）menu 分组下
UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'admin'
  AND p.code = 'mcp:manage-tokens';

-- seed 给 admin 角色（superadmin 靠 is_builtin_super_admin 通配短路）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code = 'mcp:manage-tokens'
ON CONFLICT DO NOTHING;
