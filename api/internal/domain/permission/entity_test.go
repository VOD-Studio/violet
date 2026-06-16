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
		{"missing colon", "postcreate", "", true},
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

	// 非法代码应 panic
	defer func() {
		if r := recover(); r == nil {
			t.Error("MustParse 非法代码应 panic")
		}
	}()
	MustParse("invalid")
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
	p := NewPermission(1, code, "测试权限", "用于单元测试")

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
