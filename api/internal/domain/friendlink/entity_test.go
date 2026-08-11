package friendlink

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"blog-api/internal/domain/shared"
)

// validParams 合法申请入参基线（各用例在此之上破坏单字段）。
func validParams() CreateParams {
	return CreateParams{
		ID:           shared.NewID(),
		Name:         " Wakaba 的博客",
		URL:          "https://wakaba.example.com",
		Description:  "记录折腾与生活",
		OwnerName:    "Wakaba",
		LinkbackURL:  "https://wakaba.example.com/friends",
		ContactEmail: "Wakaba@Example.com",
		IPHash:       "iphash1",
	}
}

// TestNewFriendLink_Validation 覆盖申请构造的必填/格式/长度校验与双轨字段。
func TestNewFriendLink_Validation(t *testing.T) {
	uid := shared.NewID()

	t.Run("匿名申请合法（UserID nil）", func(t *testing.T) {
		p := validParams()
		f, err := NewFriendLink(p)
		require.NoError(t, err)
		assert.Equal(t, StatusPending, f.Status(), "申请初始态应为 pending")
		assert.Nil(t, f.UserID())
		// 名称 trim、邮箱归一化（小写 + trim）
		assert.Equal(t, "Wakaba 的博客", f.Name())
		assert.Equal(t, "wakaba@example.com", f.ContactEmail())
	})

	t.Run("登录申请合法（UserID 非空）", func(t *testing.T) {
		p := validParams()
		p.UserID = &uid
		f, err := NewFriendLink(p)
		require.NoError(t, err)
		require.NotNil(t, f.UserID())
		assert.Equal(t, uid, *f.UserID())
	})

	t.Run("创建即记录 friendlink.created 事件", func(t *testing.T) {
		f, err := NewFriendLink(validParams())
		require.NoError(t, err)
		events := f.PullEvents()
		require.Len(t, events, 1)
		assert.Equal(t, "friendlink.created", events[0].EventName())
		assert.Equal(t, f.ID().String(), events[0].AggregateID().String())
	})

	cases := []struct {
		name       string
		mutate     func(*CreateParams)
		wantErrSub string
	}{
		{"名称为空拒绝", func(p *CreateParams) { p.Name = "  " }, "名称"},
		{"名称超长拒绝（31 rune）", func(p *CreateParams) { p.Name = strings.Repeat("博", 31) }, "30"},
		{"名称边界合法（30 rune）", func(p *CreateParams) { p.Name = strings.Repeat("博", 30) }, ""},
		{"URL 为空拒绝", func(p *CreateParams) { p.URL = "" }, "URL"},
		{"URL 非 http/https 拒绝", func(p *CreateParams) { p.URL = "ftp://x.com" }, "http"},
		{"URL 缺 scheme 拒绝", func(p *CreateParams) { p.URL = "wakaba.example.com" }, "http"},
		{"描述超长拒绝（81 rune）", func(p *CreateParams) { p.Description = strings.Repeat("一", 81) }, "80"},
		{"头像 URL 非 http 拒绝", func(p *CreateParams) { p.AvatarURL = "javascript:alert(1)" }, "http"},
		{"回链页 URL 非 http 拒绝", func(p *CreateParams) { p.LinkbackURL = "data:text/html,x" }, "http"},
		{"联系邮箱为空拒绝", func(p *CreateParams) { p.ContactEmail = " " }, "邮箱"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := validParams()
			tc.mutate(&p)
			_, err := NewFriendLink(p)
			if tc.wantErrSub == "" {
				assert.NoError(t, err)
			} else {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.wantErrSub)
			}
		})
	}
}

// TestNewManual_DirectApproved 手动添加构造：直接 approved、无 UserID/IPHash、邮箱可空。
func TestNewManual_DirectApproved(t *testing.T) {
	f, err := NewManual(shared.NewID(), "rua", "https://rua.plus", "", "", "", "", "", 3)
	require.NoError(t, err)
	assert.Equal(t, StatusApproved, f.Status())
	assert.Nil(t, f.UserID())
	assert.Empty(t, f.IPHash())
	assert.Empty(t, f.ContactEmail(), "手动添加邮箱可空")
	assert.Equal(t, 3, f.SortOrder())

	events := f.PullEvents()
	require.Len(t, events, 1)
	assert.Equal(t, "friendlink.created", events[0].EventName(), "手动添加同样记创建事件（审计）")

	// 手动添加也走同一字段校验
	_, err = NewManual(shared.NewID(), "", "https://rua.plus", "", "", "", "", "", 0)
	assert.Error(t, err, "名称为空拒绝")
	_, err = NewManual(shared.NewID(), "rua", "not-a-url", "", "", "", "", "", 0)
	assert.Error(t, err, "URL 非法拒绝")
}

// mustNew 构造 pending 友链（转换测试起点）。
func mustNew(t *testing.T) *FriendLink {
	t.Helper()
	f, err := NewFriendLink(validParams())
	require.NoError(t, err)
	f.PullEvents() // 丢弃创建事件，转换测试只关心状态事件
	return f
}

// mustAt 把友链推进到目标状态（转换测试起点）。
func mustAt(t *testing.T, status string) *FriendLink {
	t.Helper()
	f := mustNew(t)
	switch status {
	case StatusPending:
	case StatusApproved:
		require.NoError(t, f.Approve())
	case StatusRejected:
		require.NoError(t, f.Reject())
	case StatusDisabled:
		require.NoError(t, f.Approve())
		require.NoError(t, f.Disable())
	}
	f.PullEvents()
	require.Equal(t, status, f.Status())
	return f
}

// TestTransitions 四态状态机转换合法性（含改判与互转）+ 事件 payload。
func TestTransitions(t *testing.T) {
	type op func(*FriendLink) error
	cases := []struct {
		name      string
		from      string
		op        op
		wantOK    bool
		wantTo    string
		wantEvent string
		wantFrom  string
	}{
		{"pending 批准", StatusPending, (*FriendLink).Approve, true, StatusApproved, "friendlink.approved", StatusPending},
		{"pending 拒绝", StatusPending, (*FriendLink).Reject, true, StatusRejected, "friendlink.rejected", StatusPending},
		{"pending 下柜非法", StatusPending, (*FriendLink).Disable, false, StatusPending, "", ""},
		{"pending 恢复非法", StatusPending, (*FriendLink).Restore, false, StatusPending, "", ""},
		{"approved 再批准非法", StatusApproved, (*FriendLink).Approve, false, StatusApproved, "", ""},
		{"approved 拒绝非法", StatusApproved, (*FriendLink).Reject, false, StatusApproved, "", ""},
		{"approved 下柜", StatusApproved, (*FriendLink).Disable, true, StatusDisabled, "friendlink.disabled", StatusApproved},
		{"approved 恢复非法", StatusApproved, (*FriendLink).Restore, false, StatusApproved, "", ""},
		{"rejected 改判批准", StatusRejected, (*FriendLink).Approve, true, StatusApproved, "friendlink.approved", StatusRejected},
		{"rejected 再拒绝非法", StatusRejected, (*FriendLink).Reject, false, StatusRejected, "", ""},
		{"rejected 下柜非法", StatusRejected, (*FriendLink).Disable, false, StatusRejected, "", ""},
		{"disabled 恢复", StatusDisabled, (*FriendLink).Restore, true, StatusApproved, "friendlink.restored", StatusDisabled},
		{"disabled 批准非法（须走恢复）", StatusDisabled, (*FriendLink).Approve, false, StatusDisabled, "", ""},
		{"disabled 再下柜非法", StatusDisabled, (*FriendLink).Disable, false, StatusDisabled, "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := mustAt(t, tc.from)
			err := tc.op(f)
			if !tc.wantOK {
				require.Error(t, err, "非法转换应拒绝")
				assert.Equal(t, tc.from, f.Status(), "非法转换不应改变状态")
				assert.False(t, f.HasEvents(), "非法转换不应产生事件")
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.wantTo, f.Status())
			events := f.PullEvents()
			require.Len(t, events, 1)
			assert.Equal(t, tc.wantEvent, events[0].EventName())
		})
	}
}

// TestTransitionEventPayload 状态事件携带 From/To 与名称快照（审计 changes 依赖）。
func TestTransitionEventPayload(t *testing.T) {
	f := mustAt(t, StatusPending)
	require.NoError(t, f.Approve())
	events := f.PullEvents()
	require.Len(t, events, 1)
	approved, ok := events[0].(FriendLinkApproved)
	require.True(t, ok)
	assert.Equal(t, StatusPending, approved.From)
	assert.Equal(t, StatusApproved, approved.To)
	assert.Equal(t, "Wakaba 的博客", approved.Name)
}

// TestUpdate 编辑字段：变更记录事件、同值不记事件、非法字段拒绝。
func TestUpdate(t *testing.T) {
	t.Run("变更字段记录 updated 事件与 changes", func(t *testing.T) {
		f := mustAt(t, StatusPending)
		p := UpdateParams{
			Name: "新站名", URL: "https://new.example.com", Description: "新描述",
			OwnerName: "Wakaba", ContactEmail: "wakaba@example.com", SortOrder: 5,
		}
		require.NoError(t, f.Update(p))
		assert.Equal(t, "新站名", f.Name())
		assert.Equal(t, "https://new.example.com", f.URL())
		assert.Equal(t, 5, f.SortOrder())

		events := f.PullEvents()
		require.Len(t, events, 1)
		updated, ok := events[0].(FriendLinkUpdated)
		require.True(t, ok)
		fields := make(map[string]FriendLinkChange, len(updated.Changes))
		for _, c := range updated.Changes {
			fields[c.Field] = c
		}
		assert.Contains(t, fields, "name")
		assert.Contains(t, fields, "url")
		assert.Contains(t, fields, "description")
		assert.Contains(t, fields, "sort_order")
		assert.Equal(t, "0", fields["sort_order"].From)
		assert.Equal(t, "5", fields["sort_order"].To)
		assert.NotContains(t, fields, "owner_name", "未变更字段不进 changes")
	})

	t.Run("同值更新不产生事件（幂等防噪音）", func(t *testing.T) {
		f := mustAt(t, StatusPending)
		p := UpdateParams{
			Name: f.Name(), URL: f.URL(), AvatarURL: f.AvatarURL(), Description: f.Description(),
			OwnerName: f.OwnerName(), LinkbackURL: f.LinkbackURL(), ContactEmail: f.ContactEmail(),
			SortOrder: f.SortOrder(),
		}
		require.NoError(t, f.Update(p))
		assert.False(t, f.HasEvents())
	})

	t.Run("非法字段拒绝且不变更", func(t *testing.T) {
		f := mustAt(t, StatusPending)
		err := f.Update(UpdateParams{Name: "", URL: f.URL()})
		require.Error(t, err)
		assert.Equal(t, "Wakaba 的博客", f.Name(), "校验失败不应落地任何字段")
	})
}

// TestIsValidStatus 状态枚举校验。
func TestIsValidStatus(t *testing.T) {
	for _, s := range []string{StatusPending, StatusApproved, StatusRejected, StatusDisabled} {
		assert.True(t, IsValidStatus(s), s)
	}
	assert.False(t, IsValidStatus("deleted"))
	assert.False(t, IsValidStatus(""))
}
