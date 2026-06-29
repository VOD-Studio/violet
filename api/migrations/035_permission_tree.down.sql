-- 删除本次新增的 menu 分组节点（action 的 parent_id 由 ON DELETE CASCADE 自动置空会失败，
-- 因为 parent_id 无 ON DELETE SET NULL；先解除挂载再删 menu）
UPDATE permissions SET parent_id = NULL WHERE parent_id IS NOT NULL;

DELETE FROM permissions WHERE type = 'menu';

DROP INDEX IF EXISTS idx_permissions_parent;

ALTER TABLE permissions
    DROP COLUMN IF EXISTS is_builtin,
    DROP COLUMN IF EXISTS sort,
    DROP COLUMN IF EXISTS type,
    DROP COLUMN IF EXISTS parent_id;
