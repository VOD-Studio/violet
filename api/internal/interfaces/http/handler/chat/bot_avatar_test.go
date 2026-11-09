package chat

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/require"

	appchat "blog-api/internal/application/chat"
	appmedia "blog-api/internal/application/media"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	domainupload "blog-api/internal/domain/upload"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/infrastructure/storage"
	"blog-api/internal/middleware"
)

type avatarBotStore struct {
	domainchat.BotRepository
	bots map[domainshared.ID]*domainchat.Bot
}

func (s *avatarBotStore) FindByID(_ context.Context, id domainshared.ID) (*domainchat.Bot, error) {
	if bot := s.bots[id]; bot != nil {
		return bot, nil
	}
	return nil, domainchat.ErrBotNotFound
}

func (s *avatarBotStore) FindByToken(_ context.Context, hash string) (*domainchat.Bot, error) {
	for _, bot := range s.bots {
		if bot.TokenHash() == hash {
			return bot, nil
		}
	}
	return nil, domainchat.ErrBotNotFound
}

func (s *avatarBotStore) Save(_ context.Context, bot *domainchat.Bot) error {
	s.bots[bot.ID()] = bot
	return nil
}

type avatarUserStore struct {
	domainuser.UserRepository
	users    map[domainshared.ID]*domainuser.User
	failSave bool
}

func (s *avatarUserStore) FindByID(_ context.Context, id domainshared.ID) (*domainuser.User, error) {
	if user := s.users[id]; user != nil {
		return user, nil
	}
	return nil, domainuser.ErrNotFound
}

func (s *avatarUserStore) Save(_ context.Context, user *domainuser.User) error {
	if s.failSave {
		return errors.New("profile write failed")
	}
	s.users[user.GetID()] = user
	return nil
}

type avatarFileStore struct {
	domainupload.FileRepository
	files    map[domainshared.ID]*domainupload.File
	refs     map[domainshared.ID]int
	failSave bool
}

func (s *avatarFileStore) Save(_ context.Context, file *domainupload.File) error {
	if s.failSave {
		return errors.New("file write failed")
	}
	s.files[file.ID()] = file
	return nil
}

func (s *avatarFileStore) FindByID(_ context.Context, id domainshared.ID) (*domainupload.File, error) {
	if file := s.files[id]; file != nil {
		return file, nil
	}
	return nil, domainshared.NotFound("file not found")
}

func (s *avatarFileStore) UpdateRefCount(_ context.Context, id domainshared.ID, delta int) error {
	if s.files[id] == nil {
		return domainshared.NotFound("file")
	}
	if s.refs == nil {
		s.refs = map[domainshared.ID]int{}
	}
	s.refs[id] = max(0, s.refs[id]+delta)
	return nil
}

type avatarMemoryTransaction struct {
	bots  *avatarBotStore
	users *avatarUserStore
	files *avatarFileStore
}

func (tx *avatarMemoryTransaction) Bots() domainchat.BotRepository   { return tx.bots }
func (tx *avatarMemoryTransaction) Users() domainuser.UserRepository { return tx.users }
func (tx *avatarMemoryTransaction) Files() appchat.FileRepository    { return tx.files }

// Do 隔离聚合副本；第二张表失败时不提交第一张表的修改。
func (tx *avatarMemoryTransaction) Do(_ context.Context, _ domainshared.ID, fn func(appchat.BotAvatarTransaction) error) error {
	staged := &avatarMemoryTransaction{
		bots:  &avatarBotStore{bots: map[domainshared.ID]*domainchat.Bot{}},
		users: &avatarUserStore{users: map[domainshared.ID]*domainuser.User{}, failSave: tx.users.failSave},
		files: &avatarFileStore{files: tx.files.files, refs: map[domainshared.ID]int{}},
	}
	for id, bot := range tx.bots.bots {
		copy := *bot
		staged.bots.bots[id] = &copy
	}
	for id, user := range tx.users.users {
		copy := *user
		staged.users.users[id] = &copy
	}
	for id, count := range tx.files.refs {
		staged.files.refs[id] = count
	}
	if err := fn(staged); err != nil {
		return err
	}
	tx.bots.bots, tx.users.users = staged.bots.bots, staged.users.users
	tx.files.refs = staged.files.refs
	return nil
}

type avatarHTTPFixture struct {
	router  http.Handler
	tx      *avatarMemoryTransaction
	bot     *domainchat.Bot
	other   *domainchat.Bot
	token   string
	dir     string
	service *appchat.BotAvatarService
}

func newAvatarHTTPFixture(t *testing.T) *avatarHTTPFixture {
	t.Helper()
	tx := &avatarMemoryTransaction{
		bots:  &avatarBotStore{bots: map[domainshared.ID]*domainchat.Bot{}},
		users: &avatarUserStore{users: map[domainshared.ID]*domainuser.User{}},
		files: &avatarFileStore{files: map[domainshared.ID]*domainupload.File{}},
	}
	fixture := &avatarHTTPFixture{tx: tx, dir: t.TempDir()}
	for _, name := range []string{"saber", "otherbot"} {
		email, err := domainuser.ParseEmail(name + "@example.com")
		require.NoError(t, err)
		username, err := domainuser.ParseUsername(name)
		require.NoError(t, err)
		user := domainuser.NewUser(domainshared.NewID(), email, username, domainuser.NewPasswordHash(""))
		user.UpdateAvatarURL("/uploads/old-" + name + ".png")
		user.PullEvents()
		tx.users.users[user.GetID()] = user
		bot, token, err := domainchat.NewBot(domainshared.NewID(), user.GetID(), name, nil, time.Now())
		require.NoError(t, err)
		bot.PullEvents()
		tx.bots.bots[bot.ID()] = bot
		if name == "saber" {
			fixture.bot, fixture.token = bot, token.Value
		} else {
			fixture.other = bot
		}
	}
	uploads := appmedia.NewUploadService(tx.files, nil, storage.NewLocalStorage(fixture.dir, "/uploads/"), nil, filepath.Join(fixture.dir, "chunks"), fixture.dir, "/uploads/")
	bots := appchat.NewBotService(tx.bots, tx.users, tx.files, nil, nil)
	fixture.service = appchat.NewBotAvatarService(uploads, tx, nil)
	handler := NewBotHandler(nil, bots, nil, nil, 0).WithBotAvatars(fixture.service)
	router := chi.NewRouter()
	router.Route("/api/v1/chat/bot", func(r chi.Router) {
		r.Use(middleware.BotAuth(bots))
		r.Post("/avatar", handler.UploadAvatar)
		r.Get("/profile", handler.Profile)
	})
	fixture.router = router
	return fixture
}

func avatarPNG(t *testing.T) []byte {
	t.Helper()
	var data bytes.Buffer
	require.NoError(t, png.Encode(&data, image.NewRGBA(image.Rect(0, 0, 2, 3))))
	return data.Bytes()
}

func avatarHTTPRequest(t *testing.T, f *avatarHTTPFixture, target, token, mimeType string, data []byte, fields map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": {`form-data; name="file"; filename="avatar.png"`},
		"Content-Type":        {mimeType},
	})
	require.NoError(t, err)
	_, err = part.Write(data)
	require.NoError(t, err)
	for name, value := range fields {
		require.NoError(t, writer.WriteField(name, value))
	}
	require.NoError(t, writer.Close())
	req := httptest.NewRequest(http.MethodPost, target, &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res := httptest.NewRecorder()
	f.router.ServeHTTP(res, req)
	return res
}

func avatarHTTPProfile(t *testing.T, f *avatarHTTPFixture) appchat.BotDTO {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/chat/bot/profile", nil)
	req.Header.Set("Authorization", "Bearer "+f.token)
	res := httptest.NewRecorder()
	f.router.ServeHTTP(res, req)
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	var env struct {
		Data appchat.BotDTO `json:"data"`
	}
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &env))
	return env.Data
}

func TestBotAvatarHTTPReplacesOnlyAuthenticatedProfile(t *testing.T) {
	f := newAvatarHTTPFixture(t)
	before := avatarHTTPProfile(t, f)
	data := avatarPNG(t)
	res := avatarHTTPRequest(t, f, "/api/v1/chat/bot/avatar", f.token, "image/png", data, nil)
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	after := avatarHTTPProfile(t, f)
	require.NotEqual(t, before.AvatarURL, after.AvatarURL)
	require.Equal(t, before.ID, after.ID)
	require.Equal(t, before.UserID, after.UserID)
	require.Empty(t, after.Token)
	require.Equal(t, "/uploads/old-otherbot.png", f.tx.users.users[f.other.UserID()].AvatarURL())
	require.Nil(t, f.tx.bots.bots[f.other.ID()].AvatarID())
	file := f.tx.files.files[domainshared.MustParseID(after.AvatarID)]
	require.Equal(t, domainupload.PurposeAvatar, file.Purpose())
	require.Equal(t, f.bot.UserID(), file.OwnerID())
	stored, err := os.ReadFile(file.Path())
	require.NoError(t, err)
	require.Equal(t, data, stored)
	require.Equal(t, file.URL(), after.AvatarURL)
	require.Equal(t, file.ID(), *f.tx.bots.bots[f.bot.ID()].AvatarID())
}

func TestBotAvatarHTTPRejectsAuthenticationAndInvalidUpload(t *testing.T) {
	for _, tc := range []struct {
		name, token, query, mime string
		data                     []byte
		fields                   map[string]string
		disabled                 bool
		want                     int
	}{
		{name: "missing token", mime: "image/png", want: 401},
		{name: "wrong token", token: "wrong", mime: "image/png", want: 401},
		{name: "disabled", token: "valid", mime: "image/png", disabled: true, want: 403},
		{name: "bot target", token: "valid", mime: "image/png", fields: map[string]string{"bot_id": "other"}, want: 400},
		{name: "user target", token: "valid", mime: "image/png", fields: map[string]string{"user_id": "other"}, want: 400},
		{name: "file target", token: "valid", mime: "image/png", fields: map[string]string{"avatar_id": "other"}, want: 400},
		{name: "query target", token: "valid", query: "?bot_id=other", mime: "image/png", want: 400},
		{name: "MIME mismatch", token: "valid", mime: "image/jpeg", want: 400},
		{name: "unsupported", token: "valid", mime: "image/svg+xml", data: []byte("<svg/>"), want: 400},
		{name: "corrupt PNG", token: "valid", mime: "image/png", data: []byte("\x89PNG\r\n\x1a\ninvalid"), want: 400},
		{name: "empty", token: "valid", mime: "image/png", data: []byte{}, want: 400},
		{name: "oversize", token: "valid", mime: "image/png", data: make([]byte, appchat.MaxBotAvatarBytes+1), want: 413},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newAvatarHTTPFixture(t)
			if tc.disabled {
				f.bot.Disable(time.Now())
			}
			token := tc.token
			if token == "valid" {
				token = f.token
			}
			data := tc.data
			if data == nil {
				data = avatarPNG(t)
			}
			res := avatarHTTPRequest(t, f, "/api/v1/chat/bot/avatar"+tc.query, token, tc.mime, data, tc.fields)
			require.Equal(t, tc.want, res.Code, res.Body.String())
			require.Empty(t, f.tx.files.files)
			require.Equal(t, "/uploads/old-saber.png", f.tx.users.users[f.bot.UserID()].AvatarURL())
		})
	}
}

func TestBotAvatarHTTPFailuresPreservePreviousAvatar(t *testing.T) {
	for _, stage := range []string{"upload", "profile"} {
		t.Run(stage, func(t *testing.T) {
			f := newAvatarHTTPFixture(t)
			f.tx.files.failSave = stage == "upload"
			f.tx.users.failSave = stage == "profile"
			res := avatarHTTPRequest(t, f, "/api/v1/chat/bot/avatar", f.token, "image/png", avatarPNG(t), nil)
			require.Equal(t, 500, res.Code, res.Body.String())
			require.Equal(t, "/uploads/old-saber.png", avatarHTTPProfile(t, f).AvatarURL)
			require.Nil(t, f.tx.bots.bots[f.bot.ID()].AvatarID())
			if stage == "upload" {
				require.Empty(t, f.tx.files.files)
			} else {
				require.Len(t, f.tx.files.files, 1)
			}
		})
	}
}

type existingAvatarUploader struct {
	file *domainupload.File
	hook func()
}

func (s existingAvatarUploader) SaveBotAvatar(context.Context, appmedia.SaveBotMediaInput) (appmedia.BotMediaDTO, error) {
	if s.hook != nil {
		s.hook()
	}
	return appmedia.BotMediaDTO{ID: s.file.ID().String(), URL: s.file.URL()}, nil
}

func TestBotAvatarServiceRejectsForeignOwnerAndWrongPurpose(t *testing.T) {
	for _, tc := range []struct {
		name, purpose string
		foreign       bool
	}{
		{"foreign", domainupload.PurposeAvatar, true},
		{"chat purpose", domainupload.PurposeChat, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newAvatarHTTPFixture(t)
			owner := f.bot.UserID()
			if tc.foreign {
				owner = f.other.UserID()
			}
			file, err := domainupload.NewFile(domainshared.NewID(), owner, tc.purpose, "a.png", "/file", "/uploads/file.png", 1, "image/png", "hash")
			require.NoError(t, err)
			f.tx.files.files[file.ID()] = file
			service := appchat.NewBotAvatarService(existingAvatarUploader{file: file}, f.tx, nil)
			_, err = service.Set(context.Background(), f.bot, appmedia.SaveBotMediaInput{Data: avatarPNG(t), MIMEType: "image/png"})
			require.True(t, domainshared.IsDomainError(err, domainshared.CodeForbidden), "%v", err)
			require.Equal(t, "/uploads/old-saber.png", f.tx.users.users[f.bot.UserID()].AvatarURL())
		})
	}
}

func TestBotAvatarServiceRechecksTokenAfterUpload(t *testing.T) {
	for _, stage := range []string{"disabled", "rotated", "revoked"} {
		t.Run(stage, func(t *testing.T) {
			f := newAvatarHTTPFixture(t)
			authenticated := *f.bot
			file, err := domainupload.NewFile(domainshared.NewID(), f.bot.UserID(), domainupload.PurposeAvatar, "a.png", "/file", "/uploads/file.png", 1, "image/png", "hash")
			require.NoError(t, err)
			f.tx.files.files[file.ID()] = file
			uploader := existingAvatarUploader{file: file, hook: func() {
				switch stage {
				case "disabled":
					f.bot.Disable(time.Now())
				case "rotated":
					_, err := f.bot.RegenerateToken(time.Now())
					require.NoError(t, err)
				case "revoked":
					delete(f.tx.bots.bots, f.bot.ID())
				}
			}}
			service := appchat.NewBotAvatarService(uploader, f.tx, nil)
			_, err = service.Set(context.Background(), &authenticated, appmedia.SaveBotMediaInput{Data: avatarPNG(t), MIMEType: "image/png"})
			require.Error(t, err)
			require.Equal(t, "/uploads/old-saber.png", f.tx.users.users[f.bot.UserID()].AvatarURL())
		})
	}
}

func TestBotAvatarHTTPReplacementTransfersFileReference(t *testing.T) {
	f := newAvatarHTTPFixture(t)
	first := avatarHTTPRequest(t, f, "/api/v1/chat/bot/avatar", f.token, "image/png", avatarPNG(t), nil)
	require.Equal(t, 200, first.Code, first.Body.String())
	firstProfile := avatarHTTPProfile(t, f)
	firstID := domainshared.MustParseID(firstProfile.AvatarID)
	require.Equal(t, 1, f.tx.files.refs[firstID])
	second := avatarHTTPRequest(t, f, "/api/v1/chat/bot/avatar", f.token, "image/png", avatarPNG(t), nil)
	require.Equal(t, 200, second.Code, second.Body.String())
	secondProfile := avatarHTTPProfile(t, f)
	secondID := domainshared.MustParseID(secondProfile.AvatarID)
	require.NotEqual(t, firstID, secondID)
	require.Zero(t, f.tx.files.refs[firstID])
	require.Equal(t, 1, f.tx.files.refs[secondID])
	require.Equal(t, secondProfile.AvatarURL, f.tx.users.users[f.bot.UserID()].AvatarURL())
}
