-- name: ListProjects :many
SELECT * FROM projects ORDER BY sort_order ASC, created_at DESC;

-- name: GetProjectByID :one
SELECT * FROM projects WHERE id = $1;

-- name: CreateProject :one
INSERT INTO projects (title, description, url, github_url, image_url, tech_stack, sort_order)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: UpdateProject :one
UPDATE projects SET title = $2, description = $3, url = $4, github_url = $5, image_url = $6, tech_stack = $7, sort_order = $8, updated_at = NOW()
WHERE id = $1 RETURNING *;

-- name: DeleteProject :exec
DELETE FROM projects WHERE id = $1;
