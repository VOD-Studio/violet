-- 媒体管理相关 SQL 查询定义

-- name: CreateMedia :one
-- 创建媒体记录
INSERT INTO media (filename, original_name, mime_type, size, path, width, height, duration, uploader_id, download_permission)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: GetMediaByID :one
-- 按 ID 查询媒体记录
SELECT * FROM media
WHERE id = $1 LIMIT 1;

-- name: ListMedia :many
-- 分页查询媒体列表，按创建时间倒序
SELECT * FROM media
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: ListMediaByType :many
-- 按 MIME 类型前缀筛选媒体列表
SELECT * FROM media
WHERE mime_type LIKE $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountMedia :one
-- 统计媒体总数
SELECT COUNT(*) FROM media;

-- name: CountMediaByType :one
-- 按 MIME 类型前缀统计媒体数量
SELECT COUNT(*) FROM media
WHERE mime_type LIKE $1;

-- name: UpdateMedia :one
-- 更新媒体信息
UPDATE media
SET original_name = COALESCE($2, original_name),
    download_permission = COALESCE($3, download_permission)
WHERE id = $1
RETURNING *;

-- name: DeleteMedia :exec
-- 删除媒体记录
DELETE FROM media
WHERE id = $1;

-- name: IncrementDownloadCount :exec
-- 增加下载次数
UPDATE media
SET download_count = download_count + 1
WHERE id = $1;
