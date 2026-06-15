package user

import (
	"testing"

	"blog-api/internal/domain/shared"
)

func TestParseEmail(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{"valid", "User@Example.com", "user@example.com", false}, // 自动小写
		{"valid with space", "  user@example.com  ", "user@example.com", false},
		{"invalid no @", "userexample.com", "", true},
		{"invalid empty", "", "", true},
		{"invalid format", "user@", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseEmail(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseEmail() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got.String() != tt.want {
				t.Errorf("ParseEmail() = %v, want %v", got.String(), tt.want)
			}
		})
	}
}

func TestParseUsername(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"valid ascii", "alice123", false},
		{"valid chinese", "亲热天堂", false},
		{"valid underscore", "user_name", false},
		{"too short", "ab", true},
		{"too long", "abcdefghijklmnopqrstuvwxyz0123456789", true}, // 33 字符
		{"invalid special char", "user@name", true},
		{"empty", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseUsername(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseUsername(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestRole(t *testing.T) {
	if !RoleUser.IsValid() || !RoleAdmin.IsValid() || !RoleSuperAdmin.IsValid() {
		t.Error("预设角色应全部合法")
	}
	if Role("unknown").IsValid() {
		t.Error("未知角色应非法")
	}
	if !RoleAdmin.IsAdmin() {
		t.Error("admin 应是管理类角色")
	}
	if RoleUser.IsAdmin() {
		t.Error("user 不应是管理类角色")
	}
	if !RoleSuperAdmin.IsSuperAdmin() {
		t.Error("superadmin 应是超级管理员")
	}
}

func TestNewUser(t *testing.T) {
	email, _ := ParseEmail("test@example.com")
	username, _ := ParseUsername("testuser")
	hash := NewPasswordHash("$2a$10$somehash")

	u := NewUser(shared.NewID(), email, username, hash)

	// 工厂方法的默认值断言
	if u.Role() != RoleUser {
		t.Errorf("新用户角色应为 user，实际 %s", u.Role())
	}
	if u.EmailVerified() {
		t.Error("新用户邮箱应未验证")
	}
	if !u.IsActive() {
		t.Error("新用户应默认启用")
	}
	if !u.CanLogin() {
		t.Error("启用用户应能登录")
	}

	// 事件断言：新用户应记录 UserRegistered 事件
	events := u.PullEvents()
	if len(events) != 1 {
		t.Fatalf("新用户应记录 1 个事件，实际 %d", len(events))
	}
	if events[0].EventName() != "user.registered" {
		t.Errorf("事件名应为 user.registered，实际 %s", events[0].EventName())
	}
}

func TestUser_VerifyEmail_Idempotent(t *testing.T) {
	email, _ := ParseEmail("test@example.com")
	username, _ := ParseUsername("testuser")
	hash := NewPasswordHash("$2a$10$somehash")
	u := NewUser(shared.NewID(), email, username, hash)

	// 清空初始事件
	u.PullEvents()

	// 首次验证应记录事件
	u.VerifyEmail()
	if !u.EmailVerified() {
		t.Error("VerifyEmail 后应已验证")
	}
	if len(u.PullEvents()) != 1 {
		t.Error("首次验证应记录 UserEmailVerified 事件")
	}

	// 重复验证应幂等（不再记录事件）
	u.VerifyEmail()
	if len(u.PullEvents()) != 0 {
		t.Error("重复 VerifyEmail 应幂等，不记录事件")
	}
}

func TestUser_ChangeRole(t *testing.T) {
	email, _ := ParseEmail("test@example.com")
	username, _ := ParseUsername("testuser")
	hash := NewPasswordHash("$2a$10$somehash")
	u := NewUser(shared.NewID(), email, username, hash)

	// 合法角色
	if err := u.ChangeRole(RoleAdmin); err != nil {
		t.Errorf("ChangeRole(admin) 不应报错: %v", err)
	}
	if u.Role() != RoleAdmin {
		t.Errorf("角色应为 admin，实际 %s", u.Role())
	}

	// 非法角色
	if err := u.ChangeRole(Role("unknown")); err == nil {
		t.Error("ChangeRole 非法角色应报错")
	}
}

func TestUser_ActivateDeactivate(t *testing.T) {
	email, _ := ParseEmail("test@example.com")
	username, _ := ParseUsername("testuser")
	hash := NewPasswordHash("$2a$10$somehash")
	u := NewUser(shared.NewID(), email, username, hash)

	u.Deactivate()
	if u.IsActive() || u.CanLogin() {
		t.Error("Deactivate 后应不能登录")
	}

	u.Activate()
	if !u.IsActive() || !u.CanLogin() {
		t.Error("Activate 后应能登录")
	}
}

func TestID_Parse(t *testing.T) {
	// 合法 ID 往返
	id := shared.NewID()
	parsed, err := shared.ParseID(id.String())
	if err != nil {
		t.Errorf("ParseID 合法 ID 不应报错: %v", err)
	}
	if !id.Equal(parsed) {
		t.Error("解析后 ID 应与原 ID 相等")
	}

	// 非法格式
	if _, err := shared.ParseID("not-a-uuid"); err == nil {
		t.Error("ParseID 非法格式应报错")
	}

	// 零值检测
	var zero shared.ID
	if !zero.IsZero() {
		t.Error("未设置的 ID 应为零值")
	}
}
