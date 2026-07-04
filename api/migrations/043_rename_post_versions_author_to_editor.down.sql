-- 回滚：把 editor_id 改回 author_id。仅用于回退到 039 原始命名。
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'post_versions' AND column_name = 'editor_id'
    ) THEN
        ALTER TABLE post_versions RENAME COLUMN editor_id TO author_id;
    END IF;
END $$;
