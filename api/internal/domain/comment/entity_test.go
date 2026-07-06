package comment

import (
	"strings"
	"testing"

	"blog-api/internal/domain/shared"
)

// TestNewComment_Validation 覆盖 NewComment 的双轨认证校验。
//
// 双轨认证模型（PRD-0001）：
//   - 匿名自由评论：userID 为 nil，anchor 必须为 nil —— 合法
//   - 登录自由评论：userID 非空，anchor 为 nil —— 合法
//   - 登录批注：    userID 非空，anchor 非空 —— 合法
//   - 匿名批注：    userID 为 nil，anchor 非空 —— 非法（批注强制登录）
func TestNewComment_Validation(t *testing.T) {
	pid := shared.NewID()
	anchor := &Anchor{
		BlockID:       "abc12345",
		StartOffset:   0,
		EndOffset:     5,
		SelectedText:  "hello",
		BlockHashSync: "deadbeef",
	}
	userID := shared.NewID()

	cases := []struct {
		name       string
		params     CreateParams
		wantErr    bool
		wantErrSub string // 错误消息子串（空则不断言消息）
	}{
		{
			name: "匿名自由评论合法",
			params: CreateParams{
				ID: shared.NewID(), PostID: pid,
				AuthorName: "alice", AuthorEmail: "alice@example.com",
				Body: "好文章",
			},
		},
		{
			name: "登录自由评论合法",
			params: CreateParams{
				ID: shared.NewID(), PostID: pid, UserID: &userID,
				AuthorName: "bob", AuthorEmail: "bob@example.com",
				Body: "好文章",
			},
		},
		{
			name: "登录批注合法",
			params: CreateParams{
				ID: shared.NewID(), PostID: pid, UserID: &userID,
				AuthorName: "bob", AuthorEmail: "bob@example.com",
				Body: "这句有误", Anchor: anchor,
			},
		},
		{
			name: "匿名批注非法（强制登录）",
			params: CreateParams{
				ID: shared.NewID(), PostID: pid,
				AuthorName: "alice", AuthorEmail: "alice@example.com",
				Body: "这句有误", Anchor: anchor,
			},
			wantErr:    true,
			wantErrSub: "登录",
		},
		{
			name: "body 为空非法",
			params: CreateParams{
				ID: shared.NewID(), PostID: pid,
				AuthorName: "alice", Body: "",
			},
			wantErr:    true,
			wantErrSub: "内容",
		},
		{
			name: "昵称为空非法",
			params: CreateParams{
				ID: shared.NewID(), PostID: pid,
				AuthorName: "", Body: "好文章",
			},
			wantErr:    true,
			wantErrSub: "昵称",
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := NewComment(c.params)
			if c.wantErr {
				if err == nil {
					t.Fatalf("期望报错，实际 nil")
				}
				if c.wantErrSub != "" && !strings.Contains(err.Error(), c.wantErrSub) {
					t.Errorf("错误消息 %q 不含期望子串 %q", err.Error(), c.wantErrSub)
				}
				return
			}
			if err != nil {
				t.Fatalf("未期望报错: %v", err)
			}
			if got == nil {
				t.Fatal("返回 nil 评论")
			}
		})
	}
}

// TestNewComment_EmailNormalization 邮箱归一化保证 per-post 配额稳定。
// PRD-0001：author_email 存储前小写 + trim，否则 "Alice@X.com" 和 "alice@x.com "
// 会被识别为不同匿名身份，绕过「一篇一次」配额。
func TestNewComment_EmailNormalization(t *testing.T) {
	pid := shared.NewID()
	cases := []struct {
		in, want string
	}{
		{"Alice@Example.COM", "alice@example.com"},
		{"  bob@x.com  ", "bob@x.com"},
		{"CAROL@Y.org", "carol@y.org"},
	}
	for _, c := range cases {
		got, err := NewComment(CreateParams{
			ID: shared.NewID(), PostID: pid,
			AuthorName: "x", AuthorEmail: c.in, Body: "hi",
		})
		if err != nil {
			t.Fatalf("输入 %q 未期望报错: %v", c.in, err)
		}
		if got.AuthorEmail() != c.want {
			t.Errorf("输入 %q 归一化得 %q，期望 %q", c.in, got.AuthorEmail(), c.want)
		}
	}
}

// TestAnchor_Validation Anchor 值对象五元组校验。
func TestAnchor_Validation(t *testing.T) {
	cases := []struct {
		name    string
		anchor  Anchor
		wantErr bool
	}{
		{"合法", Anchor{BlockID: "abc12345", StartOffset: 0, EndOffset: 5, SelectedText: "hello", BlockHashSync: "deadbeef"}, false},
		{"block_id 空", Anchor{BlockID: "", StartOffset: 0, EndOffset: 5, SelectedText: "hello", BlockHashSync: "deadbeef"}, true},
		{"start >= end", Anchor{BlockID: "abc12345", StartOffset: 5, EndOffset: 5, SelectedText: "hello", BlockHashSync: "deadbeef"}, true},
		{"start 负", Anchor{BlockID: "abc12345", StartOffset: -1, EndOffset: 5, SelectedText: "hello", BlockHashSync: "deadbeef"}, true},
		{"selected_text 空", Anchor{BlockID: "abc12345", StartOffset: 0, EndOffset: 5, SelectedText: "", BlockHashSync: "deadbeef"}, true},
		{"block_hash 空", Anchor{BlockID: "abc12345", StartOffset: 0, EndOffset: 5, SelectedText: "hello", BlockHashSync: ""}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := c.anchor.Validate()
			if c.wantErr && err == nil {
				t.Error("期望报错，实际 nil")
			}
			if !c.wantErr && err != nil {
				t.Errorf("未期望报错: %v", err)
			}
		})
	}
}

// TestSetParent_TwoLevelFlat 回复的两层扁平语义：
//   - 回复顶层评论 → depth=1，path 挂顶层下
//   - 回复回复 → depth 还是 1（不嵌套），path 仍挂同一顶层下
//   - parent=nil → depth=0，path 是自己
func TestSetParent_TwoLevelFlat(t *testing.T) {
	top := newCommentForTest()
	if err := top.SetParent(nil); err != nil {
		t.Fatalf("顶层 SetParent(nil) 报错: %v", err)
	}
	if top.Depth() != 0 {
		t.Errorf("顶层 depth 期望 0，实际 %d", top.Depth())
	}
	if top.Path() != top.ID().String()+"/" {
		t.Errorf("顶层 path 期望 %s/，实际 %s", top.ID().String(), top.Path())
	}

	// 回复顶层
	reply1 := newCommentForTest()
	if err := reply1.SetParent(top); err != nil {
		t.Fatalf("回复顶层 SetParent 报错: %v", err)
	}
	if reply1.Depth() != 1 {
		t.Errorf("回复顶层 depth 期望 1，实际 %d", reply1.Depth())
	}
	if reply1.ParentID() == nil || *reply1.ParentID() != top.ID() {
		t.Error("回复顶层 parent_id 应指向顶层")
	}
	// path 前缀应是顶层 id
	if !strings.HasPrefix(reply1.Path(), top.ID().String()+"/") {
		t.Errorf("回复 path 应以顶层 id 开头，实际 %s", reply1.Path())
	}

	// 回复 reply1（回复回复）→ depth 仍是 1，不嵌套
	reply2 := newCommentForTest()
	if err := reply2.SetParent(reply1); err != nil {
		t.Fatalf("回复回复 SetParent 报错: %v", err)
	}
	if reply2.Depth() != 1 {
		t.Errorf("回复回复 depth 仍期望 1（两层扁平），实际 %d", reply2.Depth())
	}
	if reply2.ParentID() == nil || *reply2.ParentID() != reply1.ID() {
		t.Error("回复回复 parent_id 应指向被回复的那条（reply1），不是顶层")
	}
	// path 仍挂同一顶层下（前缀一致）
	if !strings.HasPrefix(reply2.Path(), top.ID().String()+"/") {
		t.Errorf("回复回复 path 仍应挂在同一顶层下，实际 %s", reply2.Path())
	}
	// 验证 path 第一段就是顶层 id（topAncestorPath 工作）
	if !strings.HasPrefix(reply2.Path(), top.ID().String()+"/") {
		t.Errorf("topAncestorPath 应取顶层，实际 %s", reply2.Path())
	}
}

// newCommentForTest 测试辅助：构造一个最小可用 Comment（双轨认证合法：登录自由评论）。
func newCommentForTest() *Comment {
	uid := shared.NewID()
	c, _ := NewComment(CreateParams{
		ID:         shared.NewID(),
		PostID:     shared.NewID(),
		UserID:     &uid,
		AuthorName: "tester",
		Body:       "hi",
	})
	return c
}

// 编译期断言：确保 shared 包错误构造函数可用（防止重构 import 失效）。
var _ = shared.BadRequest
