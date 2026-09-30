-- 回滚用户软删除：恢复全量唯一索引，删 deleted_at 列（已删用户数据随之丢失）。

DROP INDEX IF EXISTS idx_users_google_id;
DROP INDEX IF EXISTS idx_users_github_id;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_username;

CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_username ON users(username);
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);

ALTER TABLE users DROP COLUMN deleted_at;
