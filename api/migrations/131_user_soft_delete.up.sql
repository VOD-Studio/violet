-- 用户注销（软删除，PRD-0034 T9）：
-- users 加 deleted_at；身份唯一索引改部分唯一索引（WHERE deleted_at IS NULL），
-- 注销即释放 email/username/google_id/github_id 供新用户注册/绑定。
-- email/username 有两套唯一索引（GORM idx_* + 约束 *_key），全部换成部分索引；
-- 原值保留在行内（审计 + 恢复依据）。

ALTER TABLE users ADD COLUMN deleted_at timestamptz;

DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_users_google_id;
DROP INDEX IF EXISTS idx_users_github_id;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_users_github_id ON users(github_id) WHERE github_id IS NOT NULL AND deleted_at IS NULL;
