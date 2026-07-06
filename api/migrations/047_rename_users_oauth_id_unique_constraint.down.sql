-- 回滚：把 uni_users_google_id / uni_users_github_id 改回 PG 默认命名。
-- 反向守护：仅当 uni_users_* 存在时才 rename。
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid='users'::regclass AND conname='uni_users_google_id'
    ) THEN
        ALTER TABLE users RENAME CONSTRAINT uni_users_google_id TO users_google_id_key;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid='users'::regclass AND conname='uni_users_github_id'
    ) THEN
        ALTER TABLE users RENAME CONSTRAINT uni_users_github_id TO users_github_id_key;
    END IF;
END $$;
