-- 表情包组操作
-- name: GetStickerGroupByID :one
SELECT * FROM sticker_groups WHERE id = $1;

-- name: GetStickerGroupBySlug :one
SELECT * FROM sticker_groups WHERE slug = $1;

-- name: ListStickerGroups :many
SELECT * FROM sticker_groups WHERE is_active = true ORDER BY sort_order, created_at;

-- name: ListAllStickerGroups :many
SELECT * FROM sticker_groups ORDER BY sort_order, created_at;

-- name: CreateStickerGroup :one
INSERT INTO sticker_groups (name, slug, type, icon_url, description, sort_order, is_hot, is_official, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: UpdateStickerGroup :one
UPDATE sticker_groups
SET name = $2, slug = $3, icon_url = $4, description = $5, sort_order = $6, is_hot = $7, is_official = $8, is_active = $9, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteStickerGroup :exec
DELETE FROM sticker_groups WHERE id = $1;

-- name: CountStickersInGroup :one
SELECT COUNT(*) FROM stickers WHERE group_id = $1;

-- 表情包操作
-- name: GetStickerByID :one
SELECT * FROM stickers WHERE id = $1;

-- name: GetStickerBySlug :one
SELECT * FROM stickers WHERE group_id = $1 AND slug = $2;

-- name: ListStickersByGroup :many
SELECT * FROM stickers WHERE group_id = $1 AND is_active = true ORDER BY sort_order, usage_count DESC;

-- name: ListAllStickersByGroup :many
SELECT * FROM stickers WHERE group_id = $1 ORDER BY sort_order, usage_count DESC;

-- name: ListHotStickers :many
SELECT s.*, g.slug as group_slug
FROM stickers s
JOIN sticker_groups g ON s.group_id = g.id
WHERE s.is_active = true AND g.is_active = true
ORDER BY s.usage_count DESC
LIMIT $1;

-- name: CreateSticker :one
INSERT INTO stickers (group_id, name, slug, image_url, width, height, sort_order, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpdateSticker :one
UPDATE stickers
SET name = $2, slug = $3, image_url = $4, width = $5, height = $6, sort_order = $7, is_active = $8, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteSticker :exec
DELETE FROM stickers WHERE id = $1;

-- name: IncrementStickerUsage :exec
UPDATE stickers SET usage_count = usage_count + 1 WHERE id = $1;

-- name: UpdateStickersSortOrder :exec
UPDATE stickers SET sort_order = $2, updated_at = NOW() WHERE id = $1;

-- 用户收藏操作
-- name: AddFavoriteSticker :exec
INSERT INTO user_favorite_stickers (user_id, sticker_id) VALUES ($1, $2);

-- name: RemoveFavoriteSticker :exec
DELETE FROM user_favorite_stickers WHERE user_id = $1 AND sticker_id = $2;

-- name: ListUserFavoriteStickers :many
SELECT s.*, g.slug as group_slug
FROM stickers s
JOIN user_favorite_stickers f ON s.id = f.sticker_id
JOIN sticker_groups g ON s.group_id = g.id
WHERE f.user_id = $1 AND s.is_active = true AND g.is_active = true
ORDER BY f.created_at DESC;

-- name: IsStickerFavorited :one
SELECT EXISTS(SELECT 1 FROM user_favorite_stickers WHERE user_id = $1 AND sticker_id = $2);

-- 获取所有表情包（带组信息）
-- name: ListAllStickersWithGroup :many
SELECT s.*, g.name as group_name, g.slug as group_slug, g.type as group_type
FROM stickers s
JOIN sticker_groups g ON s.group_id = g.id
WHERE s.is_active = true AND g.is_active = true
ORDER BY g.sort_order, s.sort_order, s.usage_count DESC;