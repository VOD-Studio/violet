package settings

import (
	"context"
	"testing"

	domainsettings "blog-api/internal/domain/settings"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUpdateGroupRejectsDirectSecurityWrites(t *testing.T) {
	svc, _ := newSvc()
	_, err := svc.UpdateGroup(context.Background(), domainsettings.Security, 0, patch(`{"session_max_devices":3}`))
	assert.ErrorIs(t, err, ErrSecurityConfirmationRequired, "安全组必须经限时确认流程")
}

func TestSecurityChangeRequestConfirmFlow(t *testing.T) {
	svc, store := newSvc()
	svc.SetSecurityFloor(SecurityFloor{})
	ctx := context.Background()

	pending, err := svc.RequestSecurityChange(ctx, 0, patch(`{"trusted_proxies":"10.0.0.0/8","session_max_devices":3}`), "admin-1")
	require.NoError(t, err)
	assert.Equal(t, int64(0), pending.ExpectedVersion)
	assert.Equal(t, "admin-1", pending.RequestedBy)

	// 未确认前数据库不变
	assert.NotContains(t, store.values, "trusted_proxies", "待确认变更不落库")

	view, ok := svc.PendingSecurityChange()
	require.True(t, ok)
	assert.Equal(t, 2, len(view.Values))

	// 确认必须携带发起时的 pending 标识
	_, err = svc.ConfirmSecurityChange(ctx, "stale-id")
	assert.ErrorIs(t, err, ErrSecurityPendingReplaced, "旧标识确认被拒绝且槽位保留")
	_, ok = svc.PendingSecurityChange()
	require.True(t, ok, "被拒确认后槽位保留")

	// 确认后落库并生效
	snapshot, err := svc.ConfirmSecurityChange(ctx, view.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(1), snapshot.Meta.SavedVersion)
	assert.Equal(t, "10.0.0.0/8", store.values["trusted_proxies"])
	assert.Equal(t, "3", store.values["session_max_devices"])

	// 确认后 pending 清空
	_, ok = svc.PendingSecurityChange()
	assert.False(t, ok)
	_, err = svc.ConfirmSecurityChange(ctx, view.ID)
	assert.ErrorIs(t, err, ErrNoSecurityPending, "重复确认无待确认变更")
}

func TestSecurityChangeCancelKeepsPreviousConfig(t *testing.T) {
	svc, store := newSvc()
	svc.SetSecurityFloor(SecurityFloor{})
	ctx := context.Background()

	_, err := svc.RequestSecurityChange(ctx, 0, patch(`{"session_max_devices":5}`), "admin-1")
	require.NoError(t, err)
	require.NoError(t, svc.CancelSecurityChange(ctx))

	assert.NotContains(t, store.values, "session_max_devices", "取消后数据库不变")
	_, err = svc.ConfirmSecurityChange(ctx, "any")
	assert.ErrorIs(t, err, ErrNoSecurityPending, "取消后无法确认")
}

func TestSecurityChangeValidatesAgainstFloor(t *testing.T) {
	svc, _ := newSvc()
	svc.SetSecurityFloor(SecurityFloor{CookieSecureForced: true, Production: true})
	ctx := context.Background()

	_, err := svc.RequestSecurityChange(ctx, 0, patch(`{"cookie_secure":false}`), "admin-1")
	assert.Error(t, err, "部署强制 Secure 时不可关闭")

	_, err = svc.RequestSecurityChange(ctx, 0, patch(`{"trusted_origins":"http://localhost:3000"}`), "admin-1")
	assert.Error(t, err, "生产禁止非 HTTPS localhost 来源")

	_, err = svc.RequestSecurityChange(ctx, 0, patch(`{"cookie_same_site":"none"}`), "admin-1")
	assert.Error(t, err, "SameSite=None 必须配合 Secure")
}

func TestSecurityChangeVersionConflictDiscardsPending(t *testing.T) {
	svc, store := newSvc()
	svc.SetSecurityFloor(SecurityFloor{})
	ctx := context.Background()

	_, err := svc.RequestSecurityChange(ctx, 0, patch(`{"session_max_devices":2}`), "admin-1")
	require.NoError(t, err)
	// 另一路径推进版本，制造 CAS 冲突
	store.versions[domainsettings.Security] = 7

	_, err = svc.ConfirmSecurityChange(ctx, "any")
	assert.ErrorIs(t, err, domainsettings.ErrVersionConflict, "确认提交受版本 CAS 约束")

	_, ok := svc.PendingSecurityChange()
	assert.False(t, ok, "冲突后 pending 被丢弃，需重新发起")
}

func TestValidateSecurityValuesListParsing(t *testing.T) {
	values := map[string]string{
		"trusted_origins":     "https://a.example, https://b.example:8443\nhttps://c.example",
		"trusted_proxies":     "10.0.0.0/8, 192.168.1.1, fd00::/8",
		"cookie_secure":       "true",
		"cookie_same_site":    "lax",
		"session_max_devices": "10",
	}
	assert.NoError(t, validateSecurityValues(values, SecurityFloor{}))

	bad := map[string]string{"trusted_proxies": "10.0.0.0/8, not-an-ip"}
	assert.Error(t, validateSecurityValues(bad, SecurityFloor{}))

	over := map[string]string{"session_max_devices": "51"}
	assert.Error(t, validateSecurityValues(over, SecurityFloor{}))
}
