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
