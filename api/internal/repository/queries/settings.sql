-- 站点设置相关 SQL 查询定义

-- name: GetAllSettings :many
-- 获取所有站点设置项
SELECT * FROM site_settings;

-- name: GetSetting :one
-- 按键名查询单个设置项
SELECT * FROM site_settings
WHERE key = $1;

-- name: UpsertSetting :one
-- 插入或更新设置项（键存在时更新值，不存在时插入新行）
INSERT INTO site_settings (key, value, updated_at)
VALUES ($1, $2, NOW())
ON CONFLICT (key) DO UPDATE
SET value = $2, updated_at = NOW()
RETURNING *;
