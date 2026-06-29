package permission

import "testing"

func TestParseCode(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{"valid", "post:create", "post:create", false},
		{"valid single char segments", "a:b", "a:b", false},
		{"valid multi word action", "comment:approve", "comment:approve", false},
		{"no colon now valid as menu", "postcreate", "postcreate", false},
		{"valid menu code (no colon)", "post", "post", false},
		{"valid menu code single char", "a", "a", false},
		{"missing action", "post:", "", true},
		{"missing module", ":create", "", true},
		{"uppercase module", "Post:create", "", true},
		{"uppercase action", "post:Create", "", true},
		{"numbers not allowed", "post:create123", "", true},
		{"multiple colons", "post:create:extra", "", true},
		{"too long", "verylongmodulename:actionthatexceedsthelimitxxxxxxxxxxxx", "", true},
		{"empty", "", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseCode(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseCode(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
				return
			}
			if !tt.wantErr && got.String() != tt.want {
				t.Errorf("ParseCode(%q) = %v, want %v", tt.input, got.String(), tt.want)
			}
		})
	}
}

func TestMustParse(t *testing.T) {
	// 合法代码
	c := MustParse("post:create")
	if c.String() != "post:create" {
		t.Errorf("MustParse = %v, want post:create", c)
	}

	// 非法代码应 panic（含大写与标点，放宽后仍非法）
	defer func() {
		if r := recover(); r == nil {
			t.Error("MustParse 非法代码应 panic")
		}
	}()
	MustParse("Invalid!")
}

func TestCode_Equal(t *testing.T) {
	a, _ := ParseCode("post:create")
	b, _ := ParseCode("post:create")
	c, _ := ParseCode("post:delete")

	if !a.Equal(b) {
		t.Error("相同代码应 Equal")
	}
	if a.Equal(c) {
		t.Error("不同代码不应 Equal")
	}
}

func TestPredefinedCodes(t *testing.T) {
	// 验证预定义常量格式合法
	codes := []Code{
		PostCreate, PostUpdate, PostDelete, PostPublish,
		CommentDelete, CommentApprove,
		TagCreate, TagUpdate, TagDelete,
		MediaUpload, MediaDelete,
		PlaylistCreate, PlaylistUpdate, PlaylistDelete, PlaylistToggle,
		SongUpload, SongUpdate, SongDelete, SongFetchMeta,
		EmojiCreate, EmojiDelete, EmojiManageGroup,
		UserList, UserUpdateRole, UserBan,
		ProjectCreate, ProjectUpdate, ProjectDelete,
		SettingsView, SettingsUpdate,
		RoleManage, AnnouncementManage, AdminAccess,
	}
	for _, c := range codes {
		if c.String() == "" {
			t.Error("预定义权限代码不应为空")
		}
		// 重新解析验证格式
		if _, err := ParseCode(c.String()); err != nil {
			t.Errorf("预定义权限代码 %s 格式非法: %v", c, err)
		}
	}
}

func TestPermission_CRUD(t *testing.T) {
	code, _ := ParseCode("test:action")
	p := NewPermission(1, code, "测试权限", "用于单元测试", nil, "action", 0, false)

	if p.ID() != 1 {
		t.Errorf("ID = %d, want 1", p.ID())
	}
	if p.Code().String() != "test:action" {
		t.Errorf("Code = %s, want test:action", p.Code())
	}
	if p.Name() != "测试权限" {
		t.Errorf("Name = %s", p.Name())
	}

	// 更新
	p.UpdateName("更新后的名称")
	p.UpdateDescription("更新后的描述")
	if p.Name() != "更新后的名称" {
		t.Errorf("更新后 Name = %s", p.Name())
	}
	if p.Description() != "更新后的描述" {
		t.Errorf("更新后 Description = %s", p.Description())
	}
}

func TestCode_IsMenu(t *testing.T) {
	menu, _ := ParseCode("post")
	action, _ := ParseCode("post:create")
	if !menu.IsMenu() {
		t.Error("post 应为 menu")
	}
	if action.IsMenu() {
		t.Error("post:create 不应为 menu")
	}
}

func TestPermission_BuiltinGuard(t *testing.T) {
	code, _ := ParseCode("post:create")
	// 内置权限
	builtin := NewPermission(1, code, "创建文章", "", nil, "action", 0, true)
	if err := builtin.UpdateCode(code); err != ErrCannotModifyBuiltin {
		t.Errorf("内置权限改 code 应返回 ErrCannotModifyBuiltin, got %v", err)
	}
	// 内置权限仍可改名/描述/parent/sort
	builtin.UpdateName("新名")
	builtin.UpdateParent(nil)
	builtin.UpdateSort(5)
	if builtin.Name() != "新名" {
		t.Error("内置权限应可改名")
	}

	// 非内置权限可改 code
	custom, _ := ParseCode("custom:do")
	nonBuiltin := NewPermission(2, custom, "自定义", "", nil, "action", 0, false)
	newCode, _ := ParseCode("custom:done")
	if err := nonBuiltin.UpdateCode(newCode); err != nil {
		t.Errorf("非内置权限改 code 不应报错, got %v", err)
	}
	if nonBuiltin.Code().String() != "custom:done" {
		t.Error("非内置权限 code 未更新")
	}
}
