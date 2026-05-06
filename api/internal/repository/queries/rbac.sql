-- name: ListRolePermissions :many
SELECT rp.role_id, p.code AS permission_code
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id;

-- name: ListPermissions :many
SELECT code, name FROM permissions;

-- name: GetRoleByID :one
SELECT * FROM roles WHERE id = $1;

-- name: GetRoleByName :one
SELECT * FROM roles WHERE name = $1;

-- name: ListRoles :many
SELECT * FROM roles ORDER BY id;

-- name: GetPermissionsByRoleID :many
SELECT p.code, p.name
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
WHERE rp.role_id = $1;

-- name: UpdateRolePermissions :exec
DELETE FROM role_permissions WHERE role_id = $1;

-- name: AddRolePermission :exec
INSERT INTO role_permissions (role_id, permission_id)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: GetUserWithRole :one
SELECT u.*, r.id AS role_id, r.name AS role_name
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.id = $1;

-- name: GetUserRoleID :one
SELECT role_id FROM users WHERE id = $1;

-- name: CreateRole :one
INSERT INTO roles (name, description)
VALUES ($1, $2)
RETURNING *;

-- name: UpdateRole :one
UPDATE roles
SET name = $2, description = $3
WHERE id = $1
RETURNING *;

-- name: DeleteRole :exec
DELETE FROM roles WHERE id = $1;

-- name: GetRoleWithPermissions :many
SELECT r.id, r.name, r.description, r.created_at, p.code AS permission_code, p.name AS permission_name
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE r.id = $1;

-- name: CountUsersByRoleID :one
SELECT COUNT(*) FROM users WHERE role_id = $1;

-- name: GetPermissionByCode :one
SELECT * FROM permissions WHERE code = $1;

