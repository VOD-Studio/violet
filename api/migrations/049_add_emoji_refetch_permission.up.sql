-- 新增"重新拉取 B站表情"权限点（action 类型）
INSERT INTO permissions (code, name, description, type) VALUES
    ('emoji:refetch', '重新拉取表情', '触发 B站表情全量重新拉取', 'action')
ON CONFLICT (code) DO NOTHING;

-- 挂到 emoji menu 分组下
UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu' AND m.code = 'emoji' AND p.code = 'emoji:refetch';
