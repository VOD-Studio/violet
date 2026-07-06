-- 回滚：把 editor_id 改回 author_id。仅用于回退到 039 原始命名。
-- 同样双条件守卫：仅当 editor_id 存在且 author_id 不存在时才 rename，避免反向撞列名冲突。
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'post_versions' AND column_name = 'editor_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'post_versions' AND column_name = 'author_id'
    ) THEN
        ALTER TABLE post_versions RENAME COLUMN editor_id TO author_id;
    END IF;
END $$;
