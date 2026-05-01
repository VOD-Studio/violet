-- 文章表 SQL 查询定义

-- name: CreatePost :one
-- 创建文章，返回完整记录
INSERT INTO posts (title, slug, content_md, content_html, excerpt, cover_image, status, author_id, is_featured, seo_title, seo_description, seo_keywords, published_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING *;

-- name: GetPostByID :one
-- 按 ID 查询文章
SELECT * FROM posts
WHERE id = $1 LIMIT 1;

-- name: GetPostBySlug :one
-- 按 slug 查询文章，用于前端页面展示
SELECT * FROM posts
WHERE slug = $1 LIMIT 1;

-- name: ListPosts :many
-- 分页查询文章列表，支持状态筛选、标签筛选和关键词搜索
SELECT p.* FROM posts p
LEFT JOIN post_tags pt ON p.id = pt.post_id
WHERE
    (COALESCE(@status::varchar, '') = '' OR p.status = @status)
    AND (COALESCE(@tag_id::int, 0) = 0 OR pt.tag_id = @tag_id)
    AND (COALESCE(@search::varchar, '') = '' OR p.title ILIKE '%' || @search || '%' OR p.content_md ILIKE '%' || @search || '%')
GROUP BY p.id
ORDER BY p.created_at DESC
LIMIT @lim OFFSET @off;

-- name: CountPosts :one
-- 统计文章总数，用于分页
SELECT COUNT(DISTINCT p.id) FROM posts p
LEFT JOIN post_tags pt ON p.id = pt.post_id
WHERE
    (COALESCE(@status::varchar, '') = '' OR p.status = @status)
    AND (COALESCE(@tag_id::int, 0) = 0 OR pt.tag_id = @tag_id)
    AND (COALESCE(@search::varchar, '') = '' OR p.title ILIKE '%' || @search || '%' OR p.content_md ILIKE '%' || @search || '%');

-- name: UpdatePost :one
-- 更新文章内容，返回更新后的记录
UPDATE posts
SET title = $2, slug = $3, content_md = $4, content_html = $5, excerpt = $6,
    cover_image = $7, is_featured = $8, seo_title = $9, seo_description = $10, seo_keywords = $11, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeletePost :exec
-- 删除文章（级联删除关联的标签和评论）
DELETE FROM posts
WHERE id = $1;

-- name: UpdatePostStatus :one
-- 更新文章状态，发布时同时设置发布时间
UPDATE posts
SET status = $2, published_at = CASE WHEN $2::text = 'published' AND published_at IS NULL THEN NOW() ELSE published_at END, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: IncrementViewCount :exec
-- 增加文章浏览次数
UPDATE posts
SET view_count = view_count + 1
WHERE id = $1;
