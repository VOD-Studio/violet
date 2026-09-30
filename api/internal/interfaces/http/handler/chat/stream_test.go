package chat

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	appchat "blog-api/internal/application/chat"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

// streamChatRepo 只实现 FindEventsAfter：补发面测试仅依赖它。
type streamChatRepo struct {
	domainchat.ConversationRepository
	events     []domainchat.Event
	findCalled []int64
}

func (r *streamChatRepo) FindEventsAfter(_ context.Context, _ domainshared.ID, afterSequence int64, _ int) ([]domainchat.Event, error) {
	r.findCalled = append(r.findCalled, afterSequence)
	var events []domainchat.Event
	for _, event := range r.events {
		if event.Sequence > afterSequence {
			events = append(events, event)
		}
	}
	return events, nil
}

func newStreamTestServer(t *testing.T, repo *streamChatRepo) *chi.Mux {
	t.Helper()
	userID := domainshared.NewID()
	bot, _, err := domainchat.NewBot(domainshared.NewID(), userID, "A", nil, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	svc := appchat.NewService(repo, nil, nil, nil, nil, "", nil, nil, nil, nil, nil)
	handler := NewStreamHandler(appchat.NewConnectionManager(zerolog.Nop()), svc)
	router := chi.NewRouter()
	router.Use(middleware.BotAuth(commandBotLookup{"token-a": bot}))
	router.Get("/events", handler.Stream)
	return router
}

// 请求 context 预先取消：handler 写完补发帧后立即退出推送循环，测试不必等心跳。
func newCancelledStreamRequest(lastEventID string) *http.Request {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodGet, "/events", nil).WithContext(ctx)
	req.Header.Set("Authorization", "Bearer token-a")
	if lastEventID != "" {
		req.Header.Set("Last-Event-ID", lastEventID)
	}
	return req
}

func TestStreamFirstConnectSkipsEventReplay(t *testing.T) {
	repo := &streamChatRepo{events: []domainchat.Event{
		{Sequence: 1, UserID: domainshared.NewID(), Type: domainchat.EventMessageCreated, Payload: map[string]any{"conversation_id": "c1"}, CreatedAt: time.Now()},
		{Sequence: 2, UserID: domainshared.NewID(), Type: domainchat.EventMessageCreated, Payload: map[string]any{"conversation_id": "c1"}, CreatedAt: time.Now()},
	}}
	router := newStreamTestServer(t, repo)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, newCancelledStreamRequest(""))

	if res.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusOK)
	}
	if strings.Contains(res.Body.String(), "event: chat") {
		t.Fatalf("首连不应补发历史事件: %s", res.Body.String())
	}
	if len(repo.findCalled) != 0 {
		t.Fatalf("首连不应查询事件表, got findCalled = %v", repo.findCalled)
	}
}

func TestStreamReconnectReplaysEventsAfterLastEventID(t *testing.T) {
	userID := domainshared.NewID()
	repo := &streamChatRepo{events: []domainchat.Event{
		{Sequence: 1, UserID: userID, Type: domainchat.EventMessageCreated, Payload: map[string]any{"conversation_id": "c1"}, CreatedAt: time.Now()},
		{Sequence: 2, UserID: userID, Type: domainchat.EventMessageCreated, Payload: map[string]any{"conversation_id": "c1"}, CreatedAt: time.Now()},
	}}
	router := newStreamTestServer(t, repo)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, newCancelledStreamRequest("1"))

	if res.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusOK)
	}
	body := res.Body.String()
	if !strings.Contains(body, "id: 2") || strings.Contains(body, "id: 1") {
		t.Fatalf("重连只应补发 sequence>1 的事件: %s", body)
	}
	if len(repo.findCalled) != 1 || repo.findCalled[0] != 1 {
		t.Fatalf("应按 Last-Event-ID 查询一次, got findCalled = %v", repo.findCalled)
	}
}
