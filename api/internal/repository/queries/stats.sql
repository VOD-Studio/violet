-- 后台统计相关 SQL 查询

-- name: CountTotalPosts :one
-- 统计文章总数
SELECT COUNT(*) FROM posts;

-- name: CountTotalComments :one
-- 统计评论总数
SELECT COUNT(*) FROM comments;

-- name: CountAllPendingComments :one
-- 统计待审核评论数
SELECT COUNT(*) FROM comments
WHERE status = 'pending';

-- name: CountTotalViews :one
-- 统计总浏览量
SELECT COALESCE(SUM(view_count), 0)::BIGINT FROM posts;

-- name: CountTotalUsers :one
-- 统计用户总数
SELECT COUNT(*) FROM users;

-- name: GetRecentPosts :many
-- 获取最近 5 篇文章
SELECT id, title, slug, status, view_count, created_at
FROM posts
ORDER BY created_at DESC
LIMIT 5;

-- name: GetPopularPosts :many
-- 获取热门文章，按浏览量降序排列
SELECT id, title, slug, view_count, created_at
FROM posts
WHERE status = 'published'
ORDER BY view_count DESC
LIMIT 10;

-- name: GetDailyViews :many
-- 获取最近 30 天每日浏览量
SELECT
    DATE(created_at) AS date,
    COUNT(*)::BIGINT AS views
FROM post_views
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date ASC;

-- name: GetMonthlyViews :many
-- 获取最近 12 个月每月浏览量
SELECT
    TO_CHAR(created_at, 'YYYY-MM') AS month,
    COUNT(*)::BIGINT AS views
FROM post_views
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY TO_CHAR(created_at, 'YYYY-MM')
ORDER BY month ASC;

-- name: CreatePostView :exec
-- 记录文章浏览事件
INSERT INTO post_views (post_id, ip_address, user_agent)
VALUES ($1, $2, $3);
