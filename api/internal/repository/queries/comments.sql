-- 评论表 SQL 查询定义

-- name: CreateComment :one
-- 创建评论，返回完整记录
INSERT INTO comments (post_id, parent_id, path, depth, author_name, author_email, author_url, avatar_url, body, status, ip_hash, user_agent)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;

-- name: GetCommentByID :one
-- 按 ID 查询评论
SELECT * FROM comments
WHERE id = $1 LIMIT 1;

-- name: ListApprovedCommentsByPostID :many
-- 查询文章的已审核评论，按路径排序以支持嵌套展示
SELECT * FROM comments
WHERE post_id = $1 AND status = 'approved'
ORDER BY path ASC;

-- name: ListPendingComments :many
-- 查询待审核评论列表，按创建时间倒序
SELECT * FROM comments
WHERE status = 'pending'
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: UpdateCommentStatus :one
-- 更新评论状态
UPDATE comments
SET status = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteComment :exec
-- 删除评论
DELETE FROM comments
WHERE id = $1;

-- name: CountPendingComments :one
-- 统计待审核评论数
SELECT COUNT(*) FROM comments
WHERE status = 'pending';

-- name: CountCommentsByPost :one
-- 统计文章的已审核评论数
SELECT COUNT(*) FROM comments
WHERE post_id = $1 AND status = 'approved';

-- name: CountRecentCommentsByIP :one
-- 统计指定 IP 在指定时间后的评论数，用于限流
SELECT COUNT(*) FROM comments
WHERE ip_hash = $1 AND created_at > $2;
