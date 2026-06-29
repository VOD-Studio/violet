-- 权限树形化：加 parent_id / type / sort / is_builtin
ALTER TABLE permissions
    ADD COLUMN IF NOT EXISTS parent_id INT REFERENCES permissions(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS type      VARCHAR(10) NOT NULL DEFAULT 'action',
    ADD COLUMN IF NOT EXISTS sort      INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_permissions_parent ON permissions(parent_id);

-- 13 个 module 分组节点（menu 类型，内置，按业务域排序）
INSERT INTO permissions (code, name, type, parent_id, sort, is_builtin) VALUES
    ('post','文章','menu',NULL,1,TRUE),
    ('comment','评论','menu',NULL,2,TRUE),
    ('tag','标签','menu',NULL,3,TRUE),
    ('media','素材','menu',NULL,4,TRUE),
    ('playlist','歌单','menu',NULL,5,TRUE),
    ('song','歌曲','menu',NULL,6,TRUE),
    ('emoji','表情','menu',NULL,7,TRUE),
    ('user','用户','menu',NULL,8,TRUE),
    ('project','项目','menu',NULL,9,TRUE),
    ('settings','设置','menu',NULL,10,TRUE),
    ('role','角色','menu',NULL,11,TRUE),
    ('announcement','公告','menu',NULL,12,TRUE),
    ('admin','系统','menu',NULL,13,TRUE)
ON CONFLICT (code) DO NOTHING;

-- 把现有 action 权限挂到对应 menu 下
UPDATE permissions p
SET parent_id = m.id
FROM permissions m
WHERE m.type = 'menu'
  AND p.type = 'action'
  AND p.code LIKE m.code || ':%';

-- 所有现存 action 标记为内置
UPDATE permissions SET is_builtin = TRUE WHERE type = 'action';
