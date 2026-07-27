-- 059 down: 回滚 PAT 表与权限点

DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE code = 'mcp:manage-tokens');
DELETE FROM permissions WHERE code = 'mcp:manage-tokens';

DROP TABLE IF EXISTS api_tokens;
