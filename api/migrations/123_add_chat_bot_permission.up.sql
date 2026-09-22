-- 123: 聊天 Bot 管理权限点（PRD-0029）
-- chat_bots 表已在 122 建好；此处只补管理侧门禁。

INSERT INTO permissions (code, name, description, type, is_builtin) VALUES
    ('chat:bot-manage', '管理聊天 Bot', '注册、改名、启停、重置 token 与吊销站内聊天 bot', 'action', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 挂到 admin（系统）menu 分组下（同 mcp:manage-tokens：都是外部程序接入的凭据管理）
UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'admin'
  AND p.code = 'chat:bot-manage';

-- seed 给 admin 角色（superadmin 靠内置超管通配短路）
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code = 'chat:bot-manage'
ON CONFLICT DO NOTHING;
