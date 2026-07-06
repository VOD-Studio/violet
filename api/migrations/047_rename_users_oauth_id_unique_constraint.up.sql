-- 040/041 用原生 SQL `ADD COLUMN ... UNIQUE` 建 google_id/github_id 唯一约束，
-- 约束名与 backing index 名为 PG 默认的 users_google_id_key / users_github_id_key。
-- 但 model.User 的 GoogleID/GithubID 用 `uniqueIndex` tag，GORM AutoMigrate 期望
-- 索引名为 uni_users_google_id / uni_users_github_id，名字对不上导致每次启动尝试
-- DROP 不存在的 uni_users_* 约束而报 SQLSTATE 42704。
--
-- 本迁移把约束名（及其 backing index，PG 会同步改名）重命名为 GORM 期望的形态，
-- 让 DB schema 收敛到以 model 为真相源。fresh 库（由 AutoMigrate 直接建表）约束名
-- 本就是 uni_users_*，本迁移通过 information_schema 守护跳过。
-- 注：UNIQUE 约束语义不变，仍允许多个 NULL（PG 标准行为），与可空列语义一致。
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid='users'::regclass AND conname='users_google_id_key'
    ) THEN
        ALTER TABLE users RENAME CONSTRAINT users_google_id_key TO uni_users_google_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid='users'::regclass AND conname='users_github_id_key'
    ) THEN
        ALTER TABLE users RENAME CONSTRAINT users_github_id_key TO uni_users_github_id;
    END IF;
END $$;
