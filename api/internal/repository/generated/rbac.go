package generated

import (
	"context"
	"database/sql"
)

// RolePermission 角色权限关联结果
type RolePermissionRow struct {
	RoleID         int32  `json:"role_id"`
	PermissionCode string `json:"permission_code"`
}

// PermissionRow 权限定义
type PermissionRow struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

// ListRolePermissions 获取所有角色-权限映射
func (q *Queries) ListRolePermissions(ctx context.Context) ([]RolePermissionRow, error) {
	rows, err := q.db.QueryContext(ctx, `
		SELECT rp.role_id, p.code AS permission_code
		FROM role_permissions rp
		JOIN permissions p ON rp.permission_id = p.id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []RolePermissionRow
	for rows.Next() {
		var i RolePermissionRow
		if err := rows.Scan(&i.RoleID, &i.PermissionCode); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

// ListPermissions 获取所有权限定义
func (q *Queries) ListPermissions(ctx context.Context) ([]PermissionRow, error) {
	rows, err := q.db.QueryContext(ctx, `SELECT code, name FROM permissions`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []PermissionRow
	for rows.Next() {
		var i PermissionRow
		if err := rows.Scan(&i.Code, &i.Name); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

// Role 角色表结构
type Role struct {
	ID          int32  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// ListRoles 获取所有角色
func (q *Queries) ListRoles(ctx context.Context) ([]Role, error) {
	rows, err := q.db.QueryContext(ctx, `SELECT id, name, COALESCE(description, '') as description FROM roles ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Role
	for rows.Next() {
		var i Role
		if err := rows.Scan(&i.ID, &i.Name, &i.Description); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

// GetPermissionsByRoleID 获取角色的所有权限代码
func (q *Queries) GetPermissionsByRoleID(ctx context.Context, roleID int32) ([]PermissionRow, error) {
	rows, err := q.db.QueryContext(ctx, `
		SELECT p.code, p.name
		FROM role_permissions rp
		JOIN permissions p ON rp.permission_id = p.id
		WHERE rp.role_id = $1
	`, roleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []PermissionRow
	for rows.Next() {
		var i PermissionRow
		if err := rows.Scan(&i.Code, &i.Name); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	return items, rows.Err()
}

// DeleteRolePermissions 删除角色的所有权限
func (q *Queries) DeleteRolePermissions(ctx context.Context, roleID int32) error {
	_, err := q.db.ExecContext(ctx, `DELETE FROM role_permissions WHERE role_id = $1`, roleID)
	return err
}

// AddRolePermission 添加单个角色-权限关联
func (q *Queries) AddRolePermission(ctx context.Context, roleID, permissionID int32) error {
	_, err := q.db.ExecContext(ctx, `
		INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, roleID, permissionID)
	return err
}

// GetUserRoleID 获取用户的 role_id
func (q *Queries) GetUserRoleID(ctx context.Context, userID string) (sql.NullInt32, error) {
	var roleID sql.NullInt32
	err := q.db.QueryRowContext(ctx, `SELECT role_id FROM users WHERE id = $1`, userID).Scan(&roleID)
	return roleID, err
}

// GetRoleIDByName 根据角色名获取 ID
func (q *Queries) GetRoleIDByName(ctx context.Context, name string) (int32, error) {
	var id int32
	err := q.db.QueryRowContext(ctx, `SELECT id FROM roles WHERE name = $1`, name).Scan(&id)
	return id, err
}

// GetAllPermissionIDs 获取所有权限 ID
func (q *Queries) GetAllPermissionIDs(ctx context.Context) ([]int32, error) {
	rows, err := q.db.QueryContext(ctx, `SELECT id FROM permissions`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []int32
	for rows.Next() {
		var id int32
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
