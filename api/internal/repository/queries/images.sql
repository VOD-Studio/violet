-- 图片管理相关 SQL 查询定义

-- name: CreateImage :one
-- 创建图片记录
INSERT INTO images (filename, original_name, url, mime_type, size, uploaded_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListImages :many
-- 分页查询图片列表，按创建时间倒序
SELECT * FROM images
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountImages :one
-- 统计图片总数
SELECT COUNT(*) FROM images;

-- name: GetImageByID :one
-- 按 ID 查询图片
SELECT * FROM images
WHERE id = $1 LIMIT 1;

-- name: DeleteImage :exec
-- 删除图片记录
DELETE FROM images
WHERE id = $1;
