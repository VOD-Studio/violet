package chat

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	appchat "blog-api/internal/application/chat"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

type commandBotLookup map[string]*domainchat.Bot

func (l commandBotLookup) FindByToken(_ context.Context, token string) (*domainchat.Bot, error) {
	if bot := l[token]; bot != nil {
		return bot, nil
	}
	return nil, domainchat.ErrBotNotFound
}

type commandCatalogStore struct {
	catalogs map[domainshared.ID]domainchat.BotCommandCatalog
}

func (s *commandCatalogStore) Replace(_ context.Context, catalog domainchat.BotCommandCatalog) error {
	s.catalogs[catalog.BotID] = catalog
	return nil
}

func (s *commandCatalogStore) ListByBotIDs(context.Context, []domainshared.ID) (map[domainshared.ID]domainchat.BotCommandCatalog, error) {
	return s.catalogs, nil
}

func TestPutCommandsUsesAuthenticatedBotAndRejectsInvalidBodies(t *testing.T) {
	botA, _, err := domainchat.NewBot(domainshared.NewID(), domainshared.NewID(), "A", nil, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	botB, _, err := domainchat.NewBot(domainshared.NewID(), domainshared.NewID(), "B", nil, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	store := &commandCatalogStore{catalogs: map[domainshared.ID]domainchat.BotCommandCatalog{}}
	service := appchat.NewBotCommandService(nil, nil, store, nil)
	handler := NewBotHandler(nil, nil, nil).WithBotCommands(service)
	router := chi.NewRouter()
	router.Use(middleware.BotAuth(commandBotLookup{"token-a": botA, "token-b": botB}))
	router.Put("/commands", handler.PutCommands)
	valid := `{"schema_version":1,"commands":[{"id":"task.list","path":["task","list"],"description":"查看任务","arguments":[],"scope":"conversation"}]}`

	for _, tc := range []struct {
		name, token, body string
		status            int
	}{
		{"missing token", "", valid, http.StatusUnauthorized},
		{"bot A", "token-a", valid, http.StatusOK},
		{"cross-bot field", "token-a", `{"schema_version":1,"commands":[],"bot_id":"` + botB.ID().String() + `"}`, http.StatusBadRequest},
		{"oversized", "token-a", strings.Repeat(" ", maxBotCommandCatalogBytes+1), http.StatusBadRequest},
		{"bot B revoke", "token-b", `{"schema_version":1,"commands":[]}`, http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPut, "/commands", strings.NewReader(tc.body))
			if tc.token != "" {
				req.Header.Set("Authorization", "Bearer "+tc.token)
			}
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)
			if res.Code != tc.status {
				t.Fatalf("status = %d, want %d: %s", res.Code, tc.status, res.Body.String())
			}
		})
	}
	if len(store.catalogs) != 2 || len(store.catalogs[botA.ID()].Commands) != 1 || len(store.catalogs[botB.ID()].Commands) != 0 {
		t.Fatalf("只能写入凭证所属目录: %+v", store.catalogs)
	}
}
