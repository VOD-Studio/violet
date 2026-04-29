-- 分片上传相关 SQL 查询定义

-- name: CreateUploadChunk :one
-- 创建分片记录
INSERT INTO upload_chunks (upload_id, chunk_index, total_chunks, file_hash, filename, mime_type, chunk_path)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetChunksByUploadID :many
-- 按上传任务 ID 查询所有分片，按分片索引排序
SELECT * FROM upload_chunks
WHERE upload_id = $1
ORDER BY chunk_index ASC;

-- name: CountChunksByUploadID :one
-- 统计指定上传任务的已上传分片数
SELECT COUNT(*) FROM upload_chunks
WHERE upload_id = $1;

-- name: GetChunkInfo :one
-- 查询上传任务的分片信息（取第一条记录获取元数据）
SELECT upload_id, total_chunks, file_hash, filename, mime_type
FROM upload_chunks
WHERE upload_id = $1
LIMIT 1;

-- name: DeleteChunksByUploadID :exec
-- 删除指定上传任务的所有分片记录
DELETE FROM upload_chunks
WHERE upload_id = $1;
