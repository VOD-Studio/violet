-- name: CreateAuditLog :exec
INSERT INTO audit_logs (
    user_id, user_name, action, resource_type, resource_id,
    resource_name, detail, ip_address
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);

-- name: ListAuditLogs :many
SELECT id, user_id, user_name, action, resource_type, resource_id,
       resource_name, detail, ip_address, created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountAuditLogs :one
SELECT COUNT(*) FROM audit_logs;

-- name: ListAuditLogsByUser :many
SELECT id, user_id, user_name, action, resource_type, resource_id,
       resource_name, detail, ip_address, created_at
FROM audit_logs
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAuditLogsByAction :many
SELECT id, user_id, user_name, action, resource_type, resource_id,
       resource_name, detail, ip_address, created_at
FROM audit_logs
WHERE action = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAuditLogsByResource :many
SELECT id, user_id, user_name, action, resource_type, resource_id,
       resource_name, detail, ip_address, created_at
FROM audit_logs
WHERE resource_type = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAuditLogsByDateRange :many
SELECT id, user_id, user_name, action, resource_type, resource_id,
       resource_name, detail, ip_address, created_at
FROM audit_logs
WHERE created_at >= $1 AND created_at <= $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;