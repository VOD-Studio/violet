-- 用户表
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    bio             TEXT,
    role            VARCHAR(20) NOT NULL DEFAULT 'user',
    email_verified  BOOLEAN NOT NULL DEFAULT false,
    is_active       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 用户邮箱索引，加速登录查询
CREATE INDEX idx_users_email ON users(email);

-- 用户名索引，加速用户名查找
CREATE INDEX idx_users_username ON users(username);
