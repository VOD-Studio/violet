-- name: GetReactionsByComment :many
-- 获取评论的所有反应统计
SELECT
    cr.emoji_id,
    e.name as emoji_name,
    e.url as emoji_url,
    e.text_content,
    COUNT(*) as count
FROM comment_reactions cr
JOIN emojis e ON cr.emoji_id = e.id
WHERE cr.comment_id = $1
GROUP BY cr.emoji_id, e.name, e.url, e.text_content
ORDER BY count DESC;

-- name: CheckUserReaction :one
-- 检查用户是否已对评论添加指定表情
SELECT EXISTS(
    SELECT 1 FROM comment_reactions
    WHERE comment_id = $1
      AND emoji_id = $2
      AND (
          (user_id = sqlc.narg('user_id') AND user_id IS NOT NULL) OR
          (ip_hash = sqlc.narg('ip_hash') AND user_id IS NULL)
      )
) as exists;

-- name: CreateReaction :one
-- 添加表情反应
INSERT INTO comment_reactions (comment_id, emoji_id, user_id, ip_hash)
VALUES ($1, $2, sqlc.narg('user_id'), sqlc.narg('ip_hash'))
RETURNING id, comment_id, emoji_id, user_id, ip_hash, created_at;

-- name: DeleteReaction :exec
-- 删除表情反应
DELETE FROM comment_reactions
WHERE comment_id = $1
  AND emoji_id = $2
  AND (
      (user_id = sqlc.narg('user_id') AND user_id IS NOT NULL) OR
      (ip_hash = sqlc.narg('ip_hash') AND user_id IS NULL)
  );

-- name: GetReactionsByComments :many
-- 批量获取多个评论的反应统计
SELECT
    cr.comment_id,
    cr.emoji_id,
    e.name as emoji_name,
    e.url as emoji_url,
    e.text_content,
    COUNT(*) as count
FROM comment_reactions cr
JOIN emojis e ON cr.emoji_id = e.id
WHERE cr.comment_id = ANY($1::uuid[])
GROUP BY cr.comment_id, cr.emoji_id, e.name, e.url, e.text_content
ORDER BY cr.comment_id, count DESC;

-- name: GetUserReactionsByComments :many
-- 批量检查用户对多个评论的反应
SELECT DISTINCT comment_id, emoji_id
FROM comment_reactions
WHERE comment_id = ANY($1::uuid[])
  AND (
      (user_id = sqlc.narg('user_id') AND user_id IS NOT NULL) OR
      (ip_hash = sqlc.narg('ip_hash') AND user_id IS NULL)
  );
