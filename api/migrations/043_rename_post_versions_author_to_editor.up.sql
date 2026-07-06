-- 039 原列名为 author_id，语义实为"编辑这一版的操作人"，与 posts.author_id（所有者）同名异义。
-- 039 已修正为 editor_id，本迁移把已部署库的 author_id 重命名为 editor_id，使旧环境收敛。
-- fresh 部署跑过修正后的 039 时列名已是 editor_id，本迁移通过 information_schema 守护跳过。
-- 守护需同时满足「旧列存在」与「目标列不存在」：若 GORM AutoMigrate 已预建 editor_id 列，
-- 直接 RENAME 会撞 SQLSTATE 42701（column already exists），故此处双条件守卫。
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'post_versions' AND column_name = 'author_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'post_versions' AND column_name = 'editor_id'
    ) THEN
        ALTER TABLE post_versions RENAME COLUMN author_id TO editor_id;
    END IF;
END $$;
