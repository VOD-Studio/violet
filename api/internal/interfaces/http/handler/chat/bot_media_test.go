package chat

import (
	"bytes"
	"context"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	appmedia "blog-api/internal/application/media"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

type recordingBotMediaSaver struct {
	input appmedia.SaveBotMediaInput
}

func (s *recordingBotMediaSaver) SaveBotMedia(_ context.Context, input appmedia.SaveBotMediaInput) (appmedia.BotMediaDTO, error) {
	s.input = input
	return appmedia.BotMediaDTO{ID: domainshared.NewID().String(), URL: "/uploads/chat/image.png", MIMEType: input.MIMEType, Size: int64(len(input.Data))}, nil
}

func TestUploadMediaUsesAuthenticatedBot(t *testing.T) {
	bot, _, err := domainchat.NewBot(domainshared.NewID(), domainshared.NewID(), "image bot", nil, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	saver := &recordingBotMediaSaver{}
	handler := NewBotHandler(nil, nil, nil, saver, 16)
	router := chi.NewRouter()
	router.Use(middleware.BotAuth(commandBotLookup{"token": bot}))
	router.Post("/media", handler.UploadMedia)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "../../avatar.png")
	if err != nil {
		t.Fatal(err)
	}
	data := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}
	if _, err := part.Write(data); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/media", &body)
	req.Header.Set("Authorization", "Bearer token")
	req.Header.Set("Content-Type", writer.FormDataContentType())
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if res.Code != http.StatusCreated {
		t.Fatalf("status = %d: %s", res.Code, res.Body.String())
	}
	if !saver.input.OwnerID.Equal(bot.UserID()) || saver.input.MIMEType != "image/png" || !bytes.Equal(saver.input.Data, data) {
		t.Fatalf("input = %#v", saver.input)
	}
}

func TestUploadMediaRejectsOversizedFile(t *testing.T) {
	bot, _, err := domainchat.NewBot(domainshared.NewID(), domainshared.NewID(), "image bot", nil, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	handler := NewBotHandler(nil, nil, nil, &recordingBotMediaSaver{}, 3)
	router := chi.NewRouter()
	router.Use(middleware.BotAuth(commandBotLookup{"token": bot}))
	router.Post("/media", handler.UploadMedia)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("file", "image.png")
	_, _ = part.Write([]byte("four"))
	_ = writer.Close()
	req := httptest.NewRequest(http.MethodPost, "/media", &body)
	req.Header.Set("Authorization", "Bearer token")
	req.Header.Set("Content-Type", writer.FormDataContentType())
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)
	if res.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d: %s", res.Code, res.Body.String())
	}
}
