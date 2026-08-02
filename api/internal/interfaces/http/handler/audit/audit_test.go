package audit

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appaudit "blog-api/internal/application/audit"
	domainaudit "blog-api/internal/domain/audit"
)

// fakeQuery EventStore 的 stub，供 handler 测试。
type fakeQuery struct {
	events     []domainaudit.AuditEvent
	total      int64
	listFilter domainaudit.ListFilter
	byActorID  string
}

func (f *fakeQuery) List(context.Context, int, int) (domainaudit.ListResult, error) {
	return domainaudit.ListResult{Events: f.events, Total: f.total}, nil
}

func (f *fakeQuery) ListFiltered(_ context.Context, filter domainaudit.ListFilter, _ int, _ int) (domainaudit.ListResult, error) {
	f.listFilter = filter
	return domainaudit.ListResult{Events: f.events, Total: f.total}, nil
}

func (f *fakeQuery) ListByActor(_ context.Context, userID string, _ int, _ int) (domainaudit.ListResult, error) {
	f.byActorID = userID
	return domainaudit.ListResult{Events: f.events, Total: f.total}, nil
}

func (f *fakeQuery) Append(context.Context, domainaudit.AuditEvent) error {
	return nil // 查询侧不用，仅满足 EventStore 接口
}

func sampleEvent() domainaudit.AuditEvent {
	return domainaudit.AuditEvent{
		EventID: uuid.New(),
		Action:  domainaudit.ActionPublish,
		Actor: domainaudit.Actor{
			UserID: "actor-1", UserName: "admin", IPAddress: "1.2.3.4", UserAgent: "ua",
		},
		Resource:   domainaudit.ResourceRef{Type: "post", ID: "post-1", Name: "文章"},
		OccurredAt: time.Now(),
	}
}

func TestListEvents_ReturnsPagedEvents(t *testing.T) {
	fq := &fakeQuery{events: []domainaudit.AuditEvent{sampleEvent()}, total: 1}
	h := NewHandler(appaudit.NewQuery(fq))

	req := httptest.NewRequest(http.MethodGet, "/admin/logs?page=1&limit=20", nil)
	w := httptest.NewRecorder()
	h.ListEvents(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var body struct {
		Data []map[string]any `json:"data"`
		Meta struct {
			Pagination map[string]any `json:"pagination"`
		} `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Len(t, body.Data, 1)
	first := body.Data[0]
	assert.Equal(t, "publish", first["action"])
	resource, ok := first["resource"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "post", resource["type"])
	assert.NotEmpty(t, body.Meta.Pagination)
}

func TestListEvents_PassesFilters(t *testing.T) {
	fq := &fakeQuery{events: []domainaudit.AuditEvent{sampleEvent()}, total: 1}
	h := NewHandler(appaudit.NewQuery(fq))

	req := httptest.NewRequest(http.MethodGet, "/admin/logs?action=publish&resource_type=post&actor=actor-1", nil)
	w := httptest.NewRecorder()
	h.ListEvents(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.NotNil(t, fq.listFilter.Action)
	assert.Equal(t, "publish", *fq.listFilter.Action)
	require.NotNil(t, fq.listFilter.ResourceType)
	assert.Equal(t, "post", *fq.listFilter.ResourceType)
	require.NotNil(t, fq.listFilter.ActorUserID)
	assert.Equal(t, "actor-1", *fq.listFilter.ActorUserID)
}

func TestListEvents_EmptyFiltersPassedAsNil(t *testing.T) {
	fq := &fakeQuery{events: nil, total: 0}
	h := NewHandler(appaudit.NewQuery(fq))

	req := httptest.NewRequest(http.MethodGet, "/admin/logs", nil)
	w := httptest.NewRecorder()
	h.ListEvents(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Nil(t, fq.listFilter.Action, "无过滤参数时 Action 应为 nil")
	assert.Nil(t, fq.listFilter.ResourceType)
	assert.Nil(t, fq.listFilter.ActorUserID)
}

func TestListEventsByActor_PassesUserID(t *testing.T) {
	fq := &fakeQuery{events: []domainaudit.AuditEvent{sampleEvent()}, total: 1}
	h := NewHandler(appaudit.NewQuery(fq))

	req := httptest.NewRequest(http.MethodGet, "/admin/logs/user/actor-1", nil)
	req.SetPathValue("id", "actor-1")
	w := httptest.NewRecorder()
	h.ListEventsByActor(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "actor-1", fq.byActorID)
}
