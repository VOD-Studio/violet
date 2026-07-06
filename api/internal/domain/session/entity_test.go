package session

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	domainshared "blog-api/internal/domain/shared"
)

// testUserID 测试用固定 UUID（domain/shared.ParseID 要求合法 UUID 格式）。
const testUserID = "00000000-0000-0000-0000-000000000001"

// newSnap 构造最小可用的 UserSnapshot，供各测试复用。
func newSnap() UserSnapshot {
	uid, _ := domainshared.ParseID(testUserID)
	return UserSnapshot{
		UserID: uid, Email: "u@example.com", Role: "user",
		RoleID: 2, IsBuiltinSuperAdmin: false,
	}
}

// TestNewSession_GeneratesIDAndCSRF 验证创建 session 时生成不透明 id 与独立 csrf。
// 每次登录的 id 必须唯一、csrf 必须独立随机，否则可预测即鉴权崩塌。
func TestNewSession_GeneratesIDAndCSRF(t *testing.T) {
	now := time.Now()
	s1, err := NewSession(newSnap(), now, 0)
	require.NoError(t, err)
	s2, err := NewSession(newSnap(), now, 0)
	require.NoError(t, err)

	assert.NotEmpty(t, s1.ID())
	assert.Len(t, s1.ID(), 43, "32 字节 base64url 约 43 字符")
	assert.NotEqual(t, s1.ID(), s2.ID(), "每次登录 session id 必须唯一")
	assert.NotEqual(t, s1.CSRF(), s2.CSRF(), "csrf token 独立随机")
	assert.Equal(t, "u@example.com", s1.Claims().Email)
}

// TestIsExpired_NoAbsoluteLimit 验证 max<=0 时只受 idle 滑动窗口约束。
func TestIsExpired_NoAbsoluteLimit(t *testing.T) {
	now := time.Now()
	s, _ := NewSession(newSnap(), now, 0)

	// idle 窗口内（6 天 < 7 天）不过期
	assert.False(t, s.IsExpired(now.Add(6*24*time.Hour), 7*24*time.Hour))
	// 超过 idle 窗口（8 天 > 7 天）过期
	assert.True(t, s.IsExpired(now.Add(8*24*time.Hour), 7*24*time.Hour))
}

// TestIsExpired_AbsoluteDeadline 验证 max>0 时绝对寿命到点强制过期，无论活跃。
func TestIsExpired_AbsoluteDeadline(t *testing.T) {
	now := time.Now()
	s, _ := NewSession(newSnap(), now, 30*24*time.Hour)

	// 活跃且未到绝对寿命 → 不过期
	assert.False(t, s.IsExpired(now.Add(1*time.Hour), 7*24*time.Hour))
	// 到绝对寿命（31 天 > 30 天）→ 过期，即使 idle 窗口内
	assert.True(t, s.IsExpired(now.Add(31*24*time.Hour), 7*24*time.Hour))
}

// TestTouch_DoesNotRotateID 验证续期不轮换 id——命门不变量②。
// 一旦轮换 id 就要在 SSR 写 Set-Cookie，重新撞 TanStack Start 透传卡点。
func TestTouch_DoesNotRotateID(t *testing.T) {
	now := time.Now()
	s, _ := NewSession(newSnap(), now, 0)
	id := s.ID()

	s.Touch(now.Add(1 * time.Hour))

	assert.Equal(t, id, s.ID(), "续期不轮换 id（命门不变量②）")
	assert.Equal(t, now.Add(1*time.Hour), s.LastSeenAt(), "Touch 更新最近活跃时间")
}
