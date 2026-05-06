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

-- name: ListUsers :many
-- 分页查询用户列表，按创建时间倒序，支持搜索和筛选
SELECT * FROM users
WHERE
    (sqlc.narg('search')::text IS NULL OR
     username ILIKE '%' || sqlc.narg('search')::text || '%' OR
     email ILIKE '%' || sqlc.narg('search')::text || '%')
    AND (sqlc.narg('role')::text IS NULL OR role = sqlc.narg('role')::text)
    AND (sqlc.narg('is_active')::bool IS NULL OR is_active = sqlc.narg('is_active')::bool)
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountUsersWithFilters :one
-- 统计用户总数（带筛选条件）
SELECT COUNT(*) FROM users
WHERE
    (sqlc.narg('search')::text IS NULL OR
     username ILIKE '%' || sqlc.narg('search')::text || '%' OR
     email ILIKE '%' || sqlc.narg('search')::text || '%')
    AND (sqlc.narg('role')::text IS NULL OR role = sqlc.narg('role')::text)
    AND (sqlc.narg('is_active')::bool IS NULL OR is_active = sqlc.narg('is_active')::bool);

-- name: CountUsers :one
-- 统计用户总数
SELECT COUNT(*) FROM users;

-- name: UpdateUserRole :one
-- 更新用户角色（字符串）
UPDATE users
SET role = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateUserRoleByID :exec
-- 更新用户角色（使用 role_id，需要先获取角色名）
UPDATE users
SET role_id = $2, updated_at = NOW()
WHERE id = $1;

-- name: UpdateUserStatus :one
-- 更新用户启用/禁用状态
UPDATE users
SET is_active = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateUserProfile :one
-- 更新用户个人资料（用户名、简介、头像）
UPDATE users
SET username = $2, bio = $3, avatar_url = $4, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetUserDetail :one
-- 获取用户详情（包含角色信息）
SELECT u.id, u.username, u.email, u.avatar_url, u.bio, u.role, u.role_id, u.email_verified, u.is_active, u.created_at, u.updated_at,
       r.name AS role_name, r.description AS role_description
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.id = $1;

-- name: BatchUpdateUserStatus :exec
-- 批量更新用户启用/禁用状态
UPDATE users
SET is_active = $2, updated_at = NOW()
WHERE id = ANY($1::uuid[]);

-- name: GetUsersByIDs :many
-- 根据 ID 列表获取用户
SELECT id, username, email, password_hash, avatar_url, bio, role, email_verified, is_active, created_at, updated_at, role_id FROM users
WHERE id = ANY($1::uuid[]);
