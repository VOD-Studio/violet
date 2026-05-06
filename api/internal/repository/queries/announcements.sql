-- name: ListActiveAnnouncements :many
SELECT id, title, content, type, is_active, start_time, end_time, created_at
FROM announcements
WHERE is_active = true
  AND (start_time IS NULL OR start_time <= NOW())
  AND (end_time IS NULL OR end_time >= NOW())
ORDER BY created_at DESC;

-- name: ListAllAnnouncements :many
SELECT id, title, content, type, is_active, start_time, end_time, created_by, created_at, updated_at
FROM announcements
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountAnnouncements :one
SELECT COUNT(*) FROM announcements;

-- name: GetAnnouncementByID :one
SELECT id, title, content, type, is_active, start_time, end_time, created_by, created_at, updated_at
FROM announcements
WHERE id = $1;

-- name: CreateAnnouncement :one
INSERT INTO announcements (title, content, type, is_active, start_time, end_time, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, title, content, type, is_active, start_time, end_time, created_by, created_at, updated_at;

-- name: UpdateAnnouncement :one
UPDATE announcements
SET title = $2, content = $3, type = $4, is_active = $5, start_time = $6, end_time = $7, updated_at = NOW()
WHERE id = $1
RETURNING id, title, content, type, is_active, start_time, end_time, created_by, created_at, updated_at;

-- name: DeleteAnnouncement :exec
DELETE FROM announcements WHERE id = $1;