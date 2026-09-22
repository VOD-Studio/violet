package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
)

type stubBotLookup struct {
	bot    *domainchat.Bot
	err    error
	called int
	gotRaw string
}

func (s *stubBotLookup) FindByToken(_ context.Context, raw string) (*domainchat.Bot, error) {
	s.called++
	s.gotRaw = raw
	if s.err != nil {
		return nil, s.err
	}
	if s.bot == nil {
		return nil, domainchat.ErrBotNotFound
	}
	return s.bot, nil
}

func enabledBot(t *testing.T, enabled bool) *domainchat.Bot {
	t.Helper()
	bot, _, err := domainchat.NewBot(domainshared.NewID(), domainshared.NewID(), "Saber", nil, time.Now())
	require.NoError(t, err)
	if !enabled {
		bot.Disable(time.Now())
	}
	return bot
}

func TestBotAuthAcceptsBearerToken(t *testing.T) {
	bot := enabledBot(t, true)
	lookup := &stubBotLookup{bot: bot}
	downstream := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := GetBot(r.Context())
		require.NotNil(t, got, "下游必须能取到 bot")
		require.Equal(t, bot.ID(), got.ID())
		require.Equal(t, bot.UserID().String(), GetUserID(r.Context()), "bot 虚拟用户 ID 应复用 UserIDKey")
		w.WriteHeader(http.StatusOK)
	})
	for _, header := range []string{"Bearer " + bot.TokenHash(), "bearer  " + bot.TokenHash()} {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/bot/events", nil)
		req.Header.Set("Authorization", header)
		rec := httptest.NewRecorder()
		BotAuth(lookup)(downstream).ServeHTTP(rec, req)
		require.Equal(t, http.StatusOK, rec.Code, "scheme 大小写不敏感且 token 前后空白应被修剪")
	}
	require.Equal(t, bot.TokenHash(), lookup.gotRaw)
}

func TestBotAuthRejectsMissingOrForeignCredentials(t *testing.T) {
	lookup := &stubBotLookup{bot: enabledBot(t, true)}
	handler := BotAuth(lookup)

	for name, header := range map[string]string{
		"missing":          "",
		"foreign scheme":   "Token abc",
		"empty bearer":     "Bearer   ",
		"bare token value": "abc123",
	} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/bot/events", nil)
		if header != "" {
			req.Header.Set("Authorization", header)
		}
		handler(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
			t.Fatalf("%s: 不该放行到下游", name)
		})).ServeHTTP(rec, req)
		require.Equal(t, http.StatusUnauthorized, rec.Code, name)
	}
	require.Zero(t, lookup.called, "格式不合的凭据不该打到仓储")
}

func TestBotAuthDisabledBotIsForbidden(t *testing.T) {
	bot := enabledBot(t, false)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat/bot/conversations/x/messages", nil)
	req.Header.Set("Authorization", "Bearer "+bot.TokenHash())
	rec := httptest.NewRecorder()
	BotAuth(&stubBotLookup{bot: bot})(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("禁用的 bot 不该放行")
	})).ServeHTTP(rec, req)
	require.Equal(t, http.StatusForbidden, rec.Code)
}

func TestBotAuthUnknownTokenIsUnauthorized(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/bot/events", nil)
	req.Header.Set("Authorization", "Bearer violet_bot_nope")
	rec := httptest.NewRecorder()
	BotAuth(&stubBotLookup{})(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("未知 token 不该放行")
	})).ServeHTTP(rec, req)
	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestBotAuthLookupFailureIsNotUnauthorized(t *testing.T) {
	// 仓储故障必须是 5xx：映射成 401 会诱导 bot 白白重置还能用的凭据。
	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/bot/events", nil)
	req.Header.Set("Authorization", "Bearer violet_bot_ok")
	rec := httptest.NewRecorder()
	BotAuth(&stubBotLookup{err: errors.New("db down")})(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Fatal("查询失败不该放行")
	})).ServeHTTP(rec, req)
	require.Equal(t, http.StatusInternalServerError, rec.Code)
}

func TestGetBotOutsideBotAuth(t *testing.T) {
	require.Nil(t, GetBot(context.Background()))
}
