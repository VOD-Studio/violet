-- 回滚：把 tags 改回 tags_snapshot。仅用于回退到 039 原始命名。
-- 同样双条件守卫：仅当 tags 存在且 tags_snapshot 不存在时才 rename，避免反向撞列名冲突。
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'post_versions' AND column_name = 'tags'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'post_versions' AND column_name = 'tags_snapshot'
    ) THEN
        ALTER TABLE post_versions RENAME COLUMN tags TO tags_snapshot;
    END IF;
END $$;
