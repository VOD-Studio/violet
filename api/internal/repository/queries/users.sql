-- 用户表 SQL 查询定义

-- name: CreateUser :one
-- 创建新用户，返回完整的用户记录
INSERT INTO users (username, email, password_hash, role, email_verified, is_active)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetUserByEmail :one
-- 按邮箱查询用户，用于登录和找回密码
SELECT * FROM users
WHERE email = $1 LIMIT 1;

-- name: GetUserByID :one
-- 按用户 ID 查询用户，用于获取当前用户信息
SELECT * FROM users
WHERE id = $1 LIMIT 1;

-- name: GetUserByUsername :one
-- 按用户名查询用户，用于注册时检查用户名是否已存在
SELECT * FROM users
WHERE username = $1 LIMIT 1;

-- name: UpdateUserActive :exec
-- 更新用户激活状态，邮箱验证通过后激活用户
UPDATE users
SET is_active = $2, updated_at = NOW()
WHERE id = $1;

-- name: UpdateUserVerified :exec
-- 更新用户邮箱验证状态
UPDATE users
SET email_verified = $2, updated_at = NOW()
WHERE id = $1;

-- name: UpdateUserPassword :exec
-- 更新用户密码，用于密码重置
UPDATE users
SET password_hash = $2, updated_at = NOW()
WHERE id = $1;
