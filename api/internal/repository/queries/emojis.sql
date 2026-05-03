-- name: GetEmojiGroupByID :one
SELECT * FROM emoji_groups WHERE id = $1;

-- name: GetEmojiGroupByName :one
SELECT * FROM emoji_groups WHERE name = $1;

-- name: ListEmojiGroups :many
SELECT * FROM emoji_groups WHERE is_enabled = true ORDER BY sort_order;

-- name: ListAllEmojiGroups :many
SELECT * FROM emoji_groups ORDER BY sort_order;

-- name: CreateEmojiGroup :one
INSERT INTO emoji_groups (name, source, sort_order, is_enabled)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateEmojiGroup :one
UPDATE emoji_groups
SET name = $2, source = $3, sort_order = $4, is_enabled = $5
WHERE id = $1
RETURNING *;

-- name: DeleteEmojiGroup :exec
DELETE FROM emoji_groups WHERE id = $1;

-- name: GetEmojiByID :one
SELECT * FROM emojis WHERE id = $1;

-- name: GetEmojiByGroupAndName :one
SELECT * FROM emojis WHERE group_id = $1 AND name = $2;

-- name: ListEmojisByGroup :many
SELECT * FROM emojis WHERE group_id = $1 ORDER BY sort_order;

-- name: CreateEmoji :one
INSERT INTO emojis (group_id, name, url, text_content, sort_order)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateEmoji :one
UPDATE emojis
SET name = $2, url = $3, text_content = $4, sort_order = $5
WHERE id = $1
RETURNING *;

-- name: DeleteEmoji :exec
DELETE FROM emojis WHERE id = $1;

-- name: DeleteEmojisByGroup :exec
DELETE FROM emojis WHERE group_id = $1;

-- name: ListAllEmojisWithGroup :many
SELECT e.*, eg.name as group_name, eg.source as group_source
FROM emojis e
JOIN emoji_groups eg ON e.group_id = eg.id
WHERE eg.is_enabled = true
ORDER BY eg.sort_order, e.sort_order;