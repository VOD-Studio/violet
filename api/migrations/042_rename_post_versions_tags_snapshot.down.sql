-- 回滚：把 tags 改回 tags_snapshot。仅用于回退到 039 原始命名。
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'post_versions' AND column_name = 'tags'
    ) THEN
        ALTER TABLE post_versions RENAME COLUMN tags TO tags_snapshot;
    END IF;
END $$;
