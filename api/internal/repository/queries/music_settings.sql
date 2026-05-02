-- 音乐设置操作

-- name: GetMusicSettings :one
SELECT * FROM music_settings WHERE id = 1;

-- name: UpdatePlayerVersion :one
UPDATE music_settings SET player_version = $1, updated_at = NOW() WHERE id = 1 RETURNING *;