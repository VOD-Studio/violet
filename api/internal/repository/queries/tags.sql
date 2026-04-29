-- 标签表 SQL 查询定义

-- name: CreateTag :one
-- 创建标签，返回完整记录
INSERT INTO tags (name, slug)
VALUES ($1, $2)
RETURNING *;

-- name: GetTagBySlug :one
-- 按 slug 查询标签
SELECT * FROM tags
WHERE slug = $1 LIMIT 1;

-- name: GetTagByID :one
-- 按 ID 查询标签
SELECT * FROM tags
WHERE id = $1 LIMIT 1;

-- name: ListTags :many
-- 查询所有标签
SELECT * FROM tags
ORDER BY name ASC;

-- name: DeleteTag :exec
-- 删除标签（级联删除关联关系）
DELETE FROM tags
WHERE id = $1;

-- name: CreatePostTag :one
-- 关联文章和标签
INSERT INTO post_tags (post_id, tag_id)
VALUES ($1, $2)
RETURNING *;

-- name: DeletePostTags :exec
-- 删除文章的所有标签关联
DELETE FROM post_tags
WHERE post_id = $1;

-- name: ListPostTags :many
-- 查询文章的所有标签
SELECT t.* FROM tags t
INNER JOIN post_tags pt ON t.id = pt.tag_id
WHERE pt.post_id = $1
ORDER BY t.name ASC;

-- name: ListPostsByTagSlug :many
-- 按标签 slug 查询已发布文章，支持分页
SELECT p.* FROM posts p
INNER JOIN post_tags pt ON p.id = pt.post_id
INNER JOIN tags t ON pt.tag_id = t.id
WHERE t.slug = $1 AND p.status = 'published'
ORDER BY p.published_at DESC
LIMIT $2 OFFSET $3;

-- name: CountPostsByTagSlug :one
-- 按标签统计文章总数
SELECT COUNT(*) FROM posts p
INNER JOIN post_tags pt ON p.id = pt.post_id
INNER JOIN tags t ON pt.tag_id = t.id
WHERE t.slug = $1 AND p.status = 'published';
