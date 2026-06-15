package role

import (
	"testing"
	"time"
)

func TestParseRoleName(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"valid", "admin", false},
		{"valid with hyphen", "content-editor", false},
		{"valid with underscore", "power_user", false},
		{"too short", "a", true},
		{"too long", "abcdefghijklmnopqrstuvwxyz0123456789012345678901234567890", true}, // >50 chars
		{"uppercase", "Admin", true},
		{"special char", "admin!", true},
		{"empty", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseRoleName(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseRoleName(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestIsBuiltin(t *testing.T) {
	if !IsBuiltin("user") || !IsBuiltin("admin") || !IsBuiltin("superadmin") {
		t.Error("user/admin/superadmin 应是内置角色")
	}
	if IsBuiltin("editor") {
		t.Error("editor 不应是内置角色")
	}

	// RoleName.IsBuiltin 应与包级 IsBuiltin 一致
	name, _ := ParseRoleName("admin")
	if !name.IsBuiltin() {
		t.Error("RoleName.IsBuiltin(admin) 应为 true")
	}
	name2, _ := ParseRoleName("editor")
	if name2.IsBuiltin() {
		t.Error("RoleName.IsBuiltin(editor) 应为 false")
	}
}

func TestNewRole(t *testing.T) {
	name, _ := ParseRoleName("editor")
	role := NewRole(1, name, "内容编辑")

	if role.RoleID() != 1 {
		t.Errorf("RoleID = %d, want 1", role.RoleID())
	}
	if role.Name().String() != "editor" {
		t.Errorf("Name = %s, want editor", role.Name())
	}
	if len(role.PermissionCodes()) != 0 {
		t.Error("新角色应无权限")
	}
	if !role.CanDelete() {
		t.Error("非内置角色应可删除")
	}

	// 新角色应记录 RoleCreated 事件
	events := role.PullEvents()
	if len(events) != 1 {
		t.Fatalf("新角色应记录 1 个事件，实际 %d", len(events))
	}
	if events[0].EventName() != "role.created" {
		t.Errorf("事件名应为 role.created，实际 %s", events[0].EventName())
	}
}

func TestRole_BuiltinCannotRename(t *testing.T) {
	name, _ := ParseRoleName("admin")
	role := NewRole(1, name, "管理员")

	newName, _ := ParseRoleName("superadmin")
	if err := role.Rename(newName); err == nil {
		t.Error("内置角色改名应报错")
	}
}

func TestRole_Rename(t *testing.T) {
	name, _ := ParseRoleName("editor")
	role := NewRole(1, name, "编辑")

	newName, _ := ParseRoleName("content-editor")
	if err := role.Rename(newName); err != nil {
		t.Errorf("非内置角色改名不应报错: %v", err)
	}
	if role.Name().String() != "content-editor" {
		t.Errorf("改名后 Name = %s, want content-editor", role.Name())
	}
}

func TestRole_GrantRevokePermission(t *testing.T) {
	name, _ := ParseRoleName("editor")
	role := NewRole(1, name, "编辑")

	// 授权
	role.Grant("post:create")
	role.Grant("post:update")
	if !role.HasPermission("post:create") {
		t.Error("Grant 后应拥有权限")
	}
	if len(role.PermissionCodes()) != 2 {
		t.Errorf("权限数 = %d, want 2", len(role.PermissionCodes()))
	}

	// 重复授权幂等
	role.Grant("post:create")
	if len(role.PermissionCodes()) != 2 {
		t.Error("重复 Grant 应幂等")
	}

	// 撤销
	role.Revoke("post:create")
	if role.HasPermission("post:create") {
		t.Error("Revoke 后不应拥有权限")
	}

	// 撤销未拥有的权限幂等（不报错）
	role.Revoke("nonexistent")
}

func TestRole_ReplacePermissions(t *testing.T) {
	name, _ := ParseRoleName("editor")
	role := NewRole(1, name, "编辑")
	role.Grant("old:perm")
	role.PullEvents() // 清空初始事件

	// 完全替换权限集
	role.ReplacePermissions([]string{"new:perm1", "new:perm2"})

	if role.HasPermission("old:perm") {
		t.Error("替换后旧权限应被清除")
	}
	if !role.HasPermission("new:perm1") || !role.HasPermission("new:perm2") {
		t.Error("替换后应拥有新权限")
	}

	// 应记录 RolePermissionsChanged 事件
	events := role.PullEvents()
	if len(events) != 1 {
		t.Fatalf("替换权限应记录 1 个事件，实际 %d", len(events))
	}
	if events[0].EventName() != "role.permissions_changed" {
		t.Errorf("事件名应为 role.permissions_changed，实际 %s", events[0].EventName())
	}
}

func TestRole_BuiltinCannotDelete(t *testing.T) {
	name, _ := ParseRoleName("admin")
	role := NewRole(1, name, "管理员")
	if role.CanDelete() {
		t.Error("内置角色 CanDelete 应为 false")
	}

	name2, _ := ParseRoleName("editor")
	role2 := NewRole(2, name2, "编辑")
	if !role2.CanDelete() {
		t.Error("非内置角色 CanDelete 应为 true")
	}
}

func TestReconstructRole(t *testing.T) {
	name, _ := ParseRoleName("editor")
	role := ReconstructRole(5, name, "内容编辑",
		[]string{"post:create", "post:update", "comment:approve"},
		time.Time{}, time.Time{}, // 零值时间戳，仅测试用
	)

	// 重建不应触发事件
	if role.HasEvents() {
		t.Error("ReconstructRole 不应记录事件")
	}
	if len(role.PermissionCodes()) != 3 {
		t.Errorf("重建后权限数 = %d, want 3", len(role.PermissionCodes()))
	}
}
