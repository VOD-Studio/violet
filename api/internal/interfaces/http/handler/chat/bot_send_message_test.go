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

type recordingBotMessageSender struct {
	input appchat.SendMessageInput
}

func (s *recordingBotMessageSender) SendBotMessage(_ context.Context, input appchat.SendMessageInput) (appchat.MessageDTO, error) {
	s.input = input
	return appchat.MessageDTO{ID: domainshared.NewID().String(), Type: string(input.Type)}, nil
}

func TestBotSendMessageDispatchesImage(t *testing.T) {
	bot, _, err := domainchat.NewBot(domainshared.NewID(), domainshared.NewID(), "image bot", nil, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	conversationID, mediaID := domainshared.NewID(), domainshared.NewID()
	sender := &recordingBotMessageSender{}
	handler := NewBotHandler(nil, nil, nil, nil, 0)
	handler.messageSender = sender
	router := chi.NewRouter()
	router.Use(middleware.BotAuth(commandBotLookup{"token": bot}))
	router.Post("/conversations/{conversationId}/messages", handler.SendMessage)

	body := `{"type":"image","content":"caption","media_ids":["` + mediaID.String() + `"]}`
	req := httptest.NewRequest(http.MethodPost, "/conversations/"+conversationID.String()+"/messages", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	req.Header.Set("Idempotency-Key", "image-1")
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusCreated {
		t.Fatalf("status = %d: %s", res.Code, res.Body.String())
	}
	if sender.input.Type != domainchat.MessageImage || len(sender.input.MediaIDs) != 1 || !sender.input.MediaIDs[0].Equal(mediaID) {
		t.Fatalf("input = %#v", sender.input)
	}
}

func TestBotSendMessageRejectsInvalidImageRequests(t *testing.T) {
	bot, _, err := domainchat.NewBot(domainshared.NewID(), domainshared.NewID(), "image bot", nil, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	conversationID := domainshared.NewID()
	handler := NewBotHandler(nil, nil, nil, nil, 0)
	handler.messageSender = &recordingBotMessageSender{}
	router := chi.NewRouter()
	router.Use(middleware.BotAuth(commandBotLookup{"token": bot}))
	router.Post("/conversations/{conversationId}/messages", handler.SendMessage)

	for _, body := range []string{
		`{"type":"image","media_ids":[]}`,
		`{"type":"image","media_ids":["` + domainshared.NewID().String() + `"],"status":"pending"}`,
		`{"type":"video"}`,
	} {
		req := httptest.NewRequest(http.MethodPost, "/conversations/"+conversationID.String()+"/messages", strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer token")
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		if res.Code != http.StatusBadRequest {
			t.Fatalf("body %s: status = %d", body, res.Code)
		}
	}
}
