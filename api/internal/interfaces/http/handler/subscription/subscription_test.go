// Package subscription 提供 RSS 订阅管理（后台 admin）HTTP handler 测试。
//
// subscription.Handler 持有具体 *appsub.Service（非接口），无法直接注入 stub service。
// 故构造真实 appsub.Service，替换其依赖的 domainsubscription.SubscriptionRepository 为手写 stub。
package subscription

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appsub "blog-api/internal/application/subscription"
	domainshared "blog-api/internal/domain/shared"
	domainsubscription "blog-api/internal/domain/subscription"
)

// stubSubRepo 手写 stub，实现 domainsubscription.SubscriptionRepository。
// 仅覆盖 List 用到的 FindAll；其余方法靠内嵌接口保持编译通过（测试不触碰）。
type stubSubRepo struct {
	domainsubscription.SubscriptionRepository
	subs          []*domainsubscription.Subscription
	total         int64
	findAllStatus string
	findAllPage   int
	findAllLimit  int
	findAllCalled bool
}

func (s *stubSubRepo) FindAll(_ context.Context, status string, page, limit int) ([]*domainsubscription.Subscription, int64, error) {
	s.findAllCalled = true
	s.findAllStatus = status
	s.findAllPage = page
	s.findAllLimit = limit
	return s.subs, s.total, nil
}

var _ domainsubscription.SubscriptionRepository = (*stubSubRepo)(nil)

func newSubHandler(repo *stubSubRepo) *Handler {
	return NewHandler(appsub.NewService(repo, nil))
}

func newJSONRequest(method, target, body string) *http.Request {
	req := httptest.NewRequest(method, target, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

// sampleSub 构造一个可预测的订阅实体供 toDTO 序列化断言。
func sampleSub(title string) *domainsubscription.Subscription {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	return domainsubscription.Reconstruct(
		domainshared.MustParseID("00000000-0000-0000-0000-000000000001"),
		domainshared.MustParseID("00000000-0000-0000-0000-000000000002"),
		domainsubscription.SourceTypeRSS,
		"https://hnrss.org/frontpage",
		title,
		"hourly",
		false, "",
		[]string{"tech"},
		domainsubscription.StatusActive,
		0, "",
		nil, nil, nil,
		now, now,
	)
}

// =====================================================================
// List —— 分页 + status 过滤透传给 service
// =====================================================================

func TestList_OK_ReturnsItemsAndEchoesPaging(t *testing.T) {
	repo := &stubSubRepo{
		subs:  []*domainsubscription.Subscription{sampleSub("Hacker News")},
		total: 1,
	}
	h := newSubHandler(repo)

	rr := httptest.NewRecorder()
	h.List(rr, httptest.NewRequest(http.MethodGet, "/admin/subscriptions?status=active&page=2&limit=5", nil))

	require.Equal(t, http.StatusOK, rr.Code)

	var got struct {
		Data struct {
			Items []appsub.SubscriptionDTO `json:"items"`
			Total int64                    `json:"total"`
			Page  int                      `json:"page"`
			Limit int                      `json:"limit"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))

	require.Len(t, got.Data.Items, 1)
	assert.Equal(t, "Hacker News", got.Data.Items[0].Title)
	assert.Equal(t, "active", got.Data.Items[0].Status)
	assert.Equal(t, int64(1), got.Data.Total)
	assert.Equal(t, 2, got.Data.Page, "应回显钳制后的 page")
	assert.Equal(t, 5, got.Data.Limit, "应回显钳制后的 limit")

	// status/page/limit 应透传到 service（经由 service 内再次钳制后到 repo）
	assert.True(t, repo.findAllCalled)
	assert.Equal(t, "active", repo.findAllStatus)
	assert.Equal(t, 2, repo.findAllPage)
	assert.Equal(t, 5, repo.findAllLimit)
}

func TestList_ClampsMissingPagingToDefaults(t *testing.T) {
	repo := &stubSubRepo{subs: nil, total: 0}
	h := newSubHandler(repo)

	rr := httptest.NewRecorder()
	h.List(rr, httptest.NewRequest(http.MethodGet, "/admin/subscriptions", nil))

	require.Equal(t, http.StatusOK, rr.Code)

	var got struct {
		Data struct {
			Page  int `json:"page"`
			Limit int `json:"limit"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &got))
	assert.Equal(t, 1, got.Data.Page, "缺省 page 应钳制为 1")
	assert.Equal(t, 20, got.Data.Limit, "缺省 limit 应钳制为 20")
	assert.Equal(t, 1, repo.findAllPage)
	assert.Equal(t, 20, repo.findAllLimit)
}

// =====================================================================
// Create —— 参数校验（空 body → 400，不触达 service）
// =====================================================================

func TestCreate_EmptyBody_Returns400(t *testing.T) {
	h := newSubHandler(&stubSubRepo{})

	rr := httptest.NewRecorder()
	h.Create(rr, newJSONRequest(http.MethodPost, "/admin/subscriptions", ""))

	assert.Equal(t, http.StatusBadRequest, rr.Code, "空 body 应 400")
}

func TestCreate_InvalidJSON_Returns400(t *testing.T) {
	h := newSubHandler(&stubSubRepo{})

	rr := httptest.NewRecorder()
	h.Create(rr, newJSONRequest(http.MethodPost, "/admin/subscriptions", "{broken"))

	assert.Equal(t, http.StatusBadRequest, rr.Code, "非法 JSON 应 400")
}

// =====================================================================
// Update —— 空 body → 400（不触达 service）
// =====================================================================

func TestUpdate_EmptyBody_Returns400(t *testing.T) {
	h := newSubHandler(&stubSubRepo{})

	rr := httptest.NewRecorder()
	h.Update(rr, newJSONRequest(http.MethodPut, "/admin/subscriptions/abc", ""))

	assert.Equal(t, http.StatusBadRequest, rr.Code, "空 body 应 400")
}
