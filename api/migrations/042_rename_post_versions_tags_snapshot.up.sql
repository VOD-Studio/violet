-- 039 原建列名为 tags_snapshot，与模型字段名不一致（导致 GORM 写入不存在的 tags 列）。
-- 039 已修正为 tags，本迁移把已部署库的 tags_snapshot 重命名为 tags，使旧环境收敛。
-- fresh 部署跑过修正后的 039 时列名已是 tags，本迁移通过 information_schema 守护跳过。
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'post_versions' AND column_name = 'tags_snapshot'
    ) THEN
        ALTER TABLE post_versions RENAME COLUMN tags_snapshot TO tags;
    END IF;
END $$;
