package tweet

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	appmedia "blog-api/internal/application/media"
	appshared "blog-api/internal/application/shared"
	apptweet "blog-api/internal/application/tweet"
	domainchat "blog-api/internal/domain/chat"
	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
	domainuser "blog-api/internal/domain/user"
	"blog-api/internal/middleware"
)

// stubBotTweetRepo 在 stubTweetRepo 之上补齐 publication 幂等端口。
type stubBotTweetRepo struct {
	stubTweetRepo
	byRequest map[string]*domaintweet.Tweet
	published []*domaintweet.Tweet
}

func newStubBotTweetRepo() *stubBotTweetRepo {
	return &stubBotTweetRepo{
		stubTweetRepo: stubTweetRepo{byID: map[string]*domaintweet.Tweet{}},
		byRequest:     map[string]*domaintweet.Tweet{},
	}
}

func (s *stubBotTweetRepo) FindByRequestID(_ context.Context, authorID, requestID shared.ID) (*domaintweet.Tweet, error) {
	if tw, ok := s.byRequest[authorID.String()+":"+requestID.String()]; ok {
		return tw, nil
	}
	return nil, domaintweet.ErrNotFound
}

func (s *stubBotTweetRepo) Publish(_ context.Context, tw *domaintweet.Tweet, _ *domaintweet.ExternalPreviewBinding) (*domaintweet.Tweet, bool, error) {
	key := tw.AuthorID().String() + ":" + tw.Publication().ClientRequestID.String()
	if existing, ok := s.byRequest[key]; ok {
		return existing, false, nil
	}
	s.byRequest[key] = tw
	s.published = append(s.published, tw)
	return tw, true, nil
}

// botLookup BotAuth 用的凭据查询替身。
type botLookup struct{ bot *domainchat.Bot }

func (l botLookup) FindByToken(context.Context, string) (*domainchat.Bot, error) {
	return l.bot, nil
}

// serveAsBot 走一遍 BotAuth 后再调用 handler，确保 bot 身份按生产链路注入。
func serveAsBot(t *testing.T, bot *domainchat.Bot, next http.HandlerFunc, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	middleware.BotAuth(botLookup{bot: bot})(next).ServeHTTP(rec, req)
	return rec
}

func newTestBot(t *testing.T, name string) (*domainchat.Bot, domainuser.UserRepository) {
	t.Helper()
	botID := shared.NewID()
	userID := shared.NewID()
	bot, _, err := domainchat.NewBot(botID, userID, name, nil, time.Now())
	require.NoError(t, err)

	email, err := domainuser.ParseEmail("bot+" + userID.String() + "@" + domainuser.BotUserEmailDomain)
	require.NoError(t, err)
	username, err := domainuser.ParseUsername(name)
	require.NoError(t, err)
	user := domainuser.NewUser(userID, email, username, domainuser.NewPasswordHash(""))
	return bot, &stubUserRepo{users: map[string]*domainuser.User{userID.String(): user}}
}

func newBotTweetHandler(repo domaintweet.TweetRepository, comments domaintweet.CommentRepository, users domainuser.UserRepository, media botMediaSaver, maxBytes int64) *BotHandler {
	return NewBotHandler(apptweet.NewService(repo, comments, users, nil, nil, nil, nil, nil, appshared.NoopEventBus{}), media, maxBytes)
}

func TestBotCreate_MissingIdempotencyKey(t *testing.T) {
	bot, users := newTestBot(t, "helperbot")
	repo := newStubBotTweetRepo()
	h := newBotTweetHandler(repo, nil, users, nil, 0)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/tweets/bot", bytes.NewBufferString(`{"content":"hi"}`))
	rec := serveAsBot(t, bot, h.Create, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Empty(t, repo.published)
}

func TestBotCreate_ReplayReturnsSameTweet(t *testing.T) {
	bot, users := newTestBot(t, "helperbot")
	repo := newStubBotTweetRepo()
	h := newBotTweetHandler(repo, nil, users, nil, 0)
	key := shared.NewID().String()

	first := serveAsBot(t, bot, h.Create, botCreateReq(t, key, `{"content":"hello"}`))
	require.Equal(t, http.StatusCreated, first.Code, first.Body.String())
	second := serveAsBot(t, bot, h.Create, botCreateReq(t, key, `{"content":"hello"}`))
	require.Equal(t, http.StatusCreated, second.Code, second.Body.String())

	var a, b struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(first.Body.Bytes(), &a))
	require.NoError(t, json.Unmarshal(second.Body.Bytes(), &b))
	assert.Equal(t, a.Data.ID, b.Data.ID)
	assert.Len(t, repo.published, 1, "重放不应再发一条")
	assert.Equal(t, bot.UserID(), repo.published[0].AuthorID(), "作者必须是 bot 虚拟用户")
}

func TestBotCreate_ConflictOnChangedContent(t *testing.T) {
	bot, users := newTestBot(t, "helperbot")
	repo := newStubBotTweetRepo()
	h := newBotTweetHandler(repo, nil, users, nil, 0)
	key := shared.NewID().String()

	require.Equal(t, http.StatusCreated, serveAsBot(t, bot, h.Create, botCreateReq(t, key, `{"content":"one"}`)).Code)
	rec := serveAsBot(t, bot, h.Create, botCreateReq(t, key, `{"content":"two"}`))
	assert.Equal(t, http.StatusConflict, rec.Code)
	assert.Len(t, repo.published, 1)
}

func TestBotCreate_Quote(t *testing.T) {
	bot, users := newTestBot(t, "helperbot")
	repo := newStubBotTweetRepo()
	quoted := domaintweet.ReconstructTweet(shared.NewID(), authorID, "原推", nil, nil, 0, sampleTime, sampleTime)
	repo.byID[quoted.ID().String()] = quoted
	h := newBotTweetHandler(repo, nil, users, nil, 0)

	rec := serveAsBot(t, bot, h.Create, botCreateReq(t, shared.NewID().String(),
		`{"content":"转发感想","quote_of":"`+quoted.ID().String()+`"}`))
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	var body struct {
		Data struct {
			QuoteOf     string `json:"quote_of"`
			QuotedTweet struct {
				ID string `json:"id"`
			} `json:"quoted_tweet"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, quoted.ID().String(), body.Data.QuoteOf)
	assert.Equal(t, quoted.ID().String(), body.Data.QuotedTweet.ID)
}

func TestBotCreateComment_MissingIdempotencyKey(t *testing.T) {
	bot, users := newTestBot(t, "helperbot")
	repo := newStubBotTweetRepo()
	comments := newStubCommentRepo()
	tw := sampleTweet()
	repo.byID[tw.ID().String()] = tw
	h := newBotTweetHandler(repo, comments, users, nil, 0)

	req := httptest.NewRequest(http.MethodPost, "/x", bytes.NewBufferString(`{"body":"hi"}`))
	req.SetPathValue("tweetId", tw.ID().String())
	rec := serveAsBot(t, bot, h.CreateComment, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Empty(t, comments.saved)
}

func TestBotCreateComment_ReplayReturnsSameComment(t *testing.T) {
	bot, users := newTestBot(t, "helperbot")
	repo := newStubBotTweetRepo()
	tw := sampleTweet()
	repo.byID[tw.ID().String()] = tw
	comments := newStubCommentRepo()
	h := newBotTweetHandler(repo, comments, users, nil, 0)
	key := shared.NewID().String()

	first := serveAsBot(t, bot, h.CreateComment, botCommentReq(tw.ID().String(), key, `{"body":"好文"}`))
	require.Equal(t, http.StatusCreated, first.Code, first.Body.String())
	second := serveAsBot(t, bot, h.CreateComment, botCommentReq(tw.ID().String(), key, `{"body":"好文"}`))
	require.Equal(t, http.StatusCreated, second.Code, second.Body.String())

	var a, b struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(first.Body.Bytes(), &a))
	require.NoError(t, json.Unmarshal(second.Body.Bytes(), &b))
	assert.Equal(t, key, a.Data.ID)
	assert.Equal(t, a.Data.ID, b.Data.ID)
	assert.Len(t, comments.saved, 1)
}

func TestBotCreateComment_CrossTweetParentRejected(t *testing.T) {
	bot, users := newTestBot(t, "helperbot")
	repo := newStubBotTweetRepo()
	tw := sampleTweet()
	repo.byID[tw.ID().String()] = tw
	comments := newStubCommentRepo()
	parent, err := domaintweet.NewComment(shared.NewID(), authorID, "另一条推文的评论")
	require.NoError(t, err)
	require.NoError(t, parent.SetParent(nil))
	comments.byID[parent.ID().String()] = parent
	h := newBotTweetHandler(repo, comments, users, nil, 0)

	rec := serveAsBot(t, bot, h.CreateComment, botCommentReq(tw.ID().String(), shared.NewID().String(),
		`{"body":"回复","parent_id":"`+parent.ID().String()+`"}`))
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestBotDelete_ForbiddenForOthersTweet(t *testing.T) {
	bot, users := newTestBot(t, "helperbot")
	repo := newStubBotTweetRepo()
	tw := sampleTweet() // 作者是 authorID，不是 bot
	repo.byID[tw.ID().String()] = tw
	h := newBotTweetHandler(repo, nil, users, nil, 0)

	req := httptest.NewRequest(http.MethodDelete, "/x", nil)
	req.SetPathValue("tweetId", tw.ID().String())
	rec := serveAsBot(t, bot, h.Delete, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Empty(t, repo.deleted)
}

// fakeBotMedia 模拟 upload 域的 MIME 校验与大小入库，记录调用。
type fakeBotMedia struct {
	calls   int
	gotMIME string
}

func (f *fakeBotMedia) SaveBotTweetImage(_ context.Context, in appmedia.SaveBotMediaInput) (appmedia.BotMediaDTO, error) {
	f.calls++
	f.gotMIME = in.MIMEType
	if in.MIMEType != "image/png" {
		return appmedia.BotMediaDTO{}, shared.BadRequest("图片 MIME 类型与文件内容不一致")
	}
	return appmedia.BotMediaDTO{ID: "media-1", URL: "/uploads/tweet/x.png", MIMEType: in.MIMEType, Size: int64(len(in.Data))}, nil
}

func TestBotMedia_RejectsWrongMIME(t *testing.T) {
	bot, _ := newTestBot(t, "helperbot")
	saver := &fakeBotMedia{}
	h := newBotTweetHandler(newStubBotTweetRepo(), nil, &stubUserRepo{}, saver, 0)

	req := botMediaReq(t, "text/plain", []byte("not an image"))
	rec := serveAsBot(t, bot, h.UploadMedia, req)

	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Equal(t, "text/plain", saver.gotMIME)
}

func TestBotMedia_RejectsOversize(t *testing.T) {
	bot, _ := newTestBot(t, "helperbot")
	saver := &fakeBotMedia{}
	h := newBotTweetHandler(newStubBotTweetRepo(), nil, &stubUserRepo{}, saver, 4)

	rec := serveAsBot(t, bot, h.UploadMedia, botMediaReq(t, "image/png", []byte("0123456789")))

	assert.Equal(t, http.StatusRequestEntityTooLarge, rec.Code)
	assert.Zero(t, saver.calls)
}

func botCreateReq(t *testing.T, key, body string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tweets/bot", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", key)
	return req
}

func botCommentReq(tweetID, key, body string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, "/x", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", key)
	req.SetPathValue("tweetId", tweetID)
	return req
}

func botMediaReq(t *testing.T, contentType string, data []byte) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreatePart(map[string][]string{
		"Content-Disposition": {`form-data; name="file"; filename="pic.png"`},
		"Content-Type":        {contentType},
	})
	require.NoError(t, err)
	_, err = part.Write(data)
	require.NoError(t, err)
	require.NoError(t, w.Close())
	req := httptest.NewRequest(http.MethodPost, "/api/v1/tweets/bot/media", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return req
}
