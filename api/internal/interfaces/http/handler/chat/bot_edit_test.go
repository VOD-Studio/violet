package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	appchat "blog-api/internal/application/chat"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/middleware"
)

type botEditRepo struct {
	domainchat.ConversationRepository
	conversation *domainchat.Conversation
	message      *domainchat.Message
	updated      bool
}

func (r *botEditRepo) FindByIDForMember(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Conversation, error) {
	return r.conversation, nil
}

func (r *botEditRepo) FindMessage(context.Context, domainshared.ID, domainshared.ID) (*domainchat.Message, error) {
	return r.message, nil
}

func (r *botEditRepo) ListMembers(context.Context, domainshared.ID, bool) ([]*domainchat.Member, error) {
	return nil, nil
}

func (r *botEditRepo) ListMemberReadStates(context.Context, domainshared.ID) ([]domainchat.MemberReadState, error) {
	return nil, nil
}

func (r *botEditRepo) UpdateMessage(_ context.Context, message *domainchat.Message) error {
	r.message = message
	return nil
}

func (r *botEditRepo) UpdateBotReply(_ context.Context, message *domainchat.Message, _ int64, _ []domainshared.ID) ([]domainchat.Event, error) {
	r.message = message
	r.updated = true
	return nil, nil
}

func (r *botEditRepo) SaveEvent(context.Context, []domainshared.ID, domainchat.ChatEventType, map[string]any) ([]domainchat.Event, error) {
	return nil, nil
}

type botEditUsers struct {
	user *domainuser.User
}

func (u *botEditUsers) FindByID(context.Context, domainshared.ID) (*domainuser.User, error) {
	return u.user, nil
}

func (u *botEditUsers) FindByIDs(context.Context, []domainshared.ID) ([]*domainuser.User, error) {
	return []*domainuser.User{u.user}, nil
}

func (u *botEditUsers) FindByUsername(context.Context, domainuser.Username) (*domainuser.User, error) {
	return u.user, nil
}

func (u *botEditUsers) ListContacts(context.Context, string, domainshared.ID, string, domainshared.ID, int) ([]*domainuser.User, error) {
	return nil, nil
}

type botEditBots struct {
	domainchat.BotRepository
	bot *domainchat.Bot
}

func (b *botEditBots) FindByUserID(context.Context, domainshared.ID) (*domainchat.Bot, error) {
	return b.bot, nil
}

func newBotEditRouter(t *testing.T) (*chi.Mux, *botEditRepo, *domainchat.Bot, domainshared.ID) {
	t.Helper()
	now := time.Date(2026, 9, 23, 12, 0, 0, 0, time.UTC)
	conversationID, botUserID := domainshared.NewID(), domainshared.NewID()
	bot, _, err := domainchat.NewBot(domainshared.NewID(), botUserID, "Saber", nil, now)
	if err != nil {
		t.Fatal(err)
	}
	message, err := domainchat.NewPendingBotMessage(conversationID, botUserID, "tool-calls-1", now, nil)
	if err != nil {
		t.Fatal(err)
	}
	repo := &botEditRepo{
		conversation: domainchat.ReconstructConversation(conversationID, botUserID, domainchat.ConversationDirect, "", nil, now, now),
		message:      message,
	}
	email, _ := domainuser.ParseEmail("saber@example.com")
	username, _ := domainuser.ParseUsername("saber")
	users := &botEditUsers{user: domainuser.NewUser(botUserID, email, username, domainuser.PasswordHash{})}
	svc := appchat.NewService(repo, users, nil, nil, nil, "", func() time.Time { return now }, nil, nil, nil, nil).
		WithBotRepository(&botEditBots{bot: bot})
	handler := NewBotHandler(svc, nil, nil, nil, 0)
	router := chi.NewRouter()
	router.Use(middleware.BotAuth(commandBotLookup{"token": bot}))
	router.Patch("/conversations/{conversationId}/messages/{messageId}", handler.EditMessage)
	return router, repo, bot, message.ID()
}

func TestBotEditMessageAcceptsToolCalls(t *testing.T) {
	router, repo, _, messageID := newBotEditRouter(t)
	body := `{"content":"累计正文","tool_calls":[{"id":"call_abc","name":" web_search ","arguments":"{\"q\":\"x\"}","duration_ms":3120}],"status":"streaming","revision":1}`
	req := httptest.NewRequest(http.MethodPatch, "/conversations/"+repo.conversation.ID().String()+"/messages/"+messageID.String(), strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", res.Code, res.Body.String())
	}
	var envelope struct {
		Data appchat.MessageDTO `json:"data"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Data.BotReply == nil || len(envelope.Data.BotReply.ToolCalls) != 1 {
		t.Fatalf("bot_reply.tool_calls = %+v", envelope.Data.BotReply)
	}
	call := envelope.Data.BotReply.ToolCalls[0]
	if call.ID != "call_abc" || call.Name != "web_search" || call.Status != "completed" || call.Arguments != `{"q":"x"}` || call.DurationMS != 3120 {
		t.Fatalf("tool call = %+v", call)
	}
	if stored := repo.message.BotReply().ToolCalls(); len(stored) != 1 || stored[0].ID != "call_abc" {
		t.Fatalf("stored tool calls = %+v", stored)
	}
}

func TestBotEditMessageRejectsOverlargeToolCalls(t *testing.T) {
	router, repo, _, messageID := newBotEditRouter(t)
	calls := make([]string, domainchat.MaxBotToolCalls+1)
	for i := range calls {
		calls[i] = `{"name":"web_search"}`
	}
	body := fmt.Sprintf(`{"content":"累计正文","tool_calls":[%s],"status":"streaming","revision":1}`, strings.Join(calls, ","))
	req := httptest.NewRequest(http.MethodPatch, "/conversations/"+repo.conversation.ID().String()+"/messages/"+messageID.String(), strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400: %s", res.Code, res.Body.String())
	}
	if repo.updated {
		t.Fatal("超限快照不应写入")
	}
}

func TestBotEditMessageWithoutStatusKeepsToolCalls(t *testing.T) {
	router, repo, _, messageID := newBotEditRouter(t)
	now := time.Date(2026, 9, 23, 12, 0, 0, 0, time.UTC)
	calls := []domainchat.BotToolCall{{ID: "call_1", Name: "web_search", Status: domainchat.BotToolCallRunning}}
	if err := repo.message.AdvanceBotReply("", "", calls, domainchat.BotReplyStreaming, 1, now); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodPatch, "/conversations/"+repo.conversation.ID().String()+"/messages/"+messageID.String(), strings.NewReader(`{"content":"旧协议正文"}`))
	req.Header.Set("Authorization", "Bearer token")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400: %s", res.Code, res.Body.String())
	}
	if repo.updated {
		t.Fatal("省略 status 应走旧版编辑，不应写入生成快照")
	}
	if stored := repo.message.BotReply().ToolCalls(); len(stored) != 1 || stored[0].ID != "call_1" {
		t.Fatalf("旧版编辑不应改动工具调用: %+v", stored)
	}
}
