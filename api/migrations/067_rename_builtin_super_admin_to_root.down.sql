-- 回滚：is_root → is_builtin_super_admin
ALTER TABLE users RENAME COLUMN is_root TO is_builtin_super_admin;
