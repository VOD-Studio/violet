-- 歌单操作

-- name: GetPlaylistByID :one
SELECT * FROM playlists WHERE id = $1;

-- name: GetPlaylistByPlatformAndID :one
SELECT * FROM playlists WHERE platform = $1 AND playlist_id = $2;

-- name: GetActivePlaylist :one
SELECT * FROM playlists WHERE is_active = true LIMIT 1;

-- name: ListPlaylists :many
SELECT * FROM playlists ORDER BY created_at DESC;

-- name: CreatePlaylist :one
INSERT INTO playlists (title, cover, creator, platform, playlist_id, song_count, songs, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpdatePlaylist :one
UPDATE playlists
SET title = $2, is_active = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdatePlaylistSongs :one
UPDATE playlists
SET songs = $2, song_count = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SetActivePlaylist :exec
UPDATE playlists SET is_active = false WHERE is_active = true;

-- name: SetPlaylistActive :one
UPDATE playlists
SET is_active = true, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeletePlaylist :exec
DELETE FROM playlists WHERE id = $1;

-- name: CountPlaylists :one
SELECT COUNT(*) FROM playlists;

-- name: GetAllActivePlaylists :many
SELECT * FROM playlists WHERE is_active = true ORDER BY created_at DESC;