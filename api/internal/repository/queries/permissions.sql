-- name: CreatePermission :one
INSERT INTO permissions (code, name, description)
VALUES ($1, $2, $3)
RETURNING *;

-- name: UpdatePermission :one
UPDATE permissions
SET name = $2, description = $3
WHERE code = $1
RETURNING *;

-- name: DeletePermission :exec
DELETE FROM permissions WHERE code = $1;