package chat

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/require"

	appcustomemoji "blog-api/internal/application/customemoji"
	appmedia "blog-api/internal/application/media"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

type stubBotEmojiCatalog struct {
	groups []appmedia.EmojiGroupDTO
	err    error
}

func (s *stubBotEmojiCatalog) GetAll(context.Context) ([]appmedia.EmojiGroupDTO, error) {
	return s.groups, s.err
}

type stubBotCustomEmojiLibrary struct {
	mine          appcustomemoji.MineDTO
	listErr       error
	favoriteErr   error
	unfavoriteErr error
	actor         domainshared.ID
	favoritedID   domainshared.ID
	unfavoritedID domainshared.ID
}

func (s *stubBotCustomEmojiLibrary) ListMine(context.Context, domainshared.ID) (appcustomemoji.MineDTO, error) {
	return s.mine, s.listErr
}

func (s *stubBotCustomEmojiLibrary) Favorite(_ context.Context, userID, emojiID domainshared.ID) error {
	s.actor, s.favoritedID = userID, emojiID
	return s.favoriteErr
}

func (s *stubBotCustomEmojiLibrary) Unfavorite(_ context.Context, userID, emojiID domainshared.ID) error {
	s.actor, s.unfavoritedID = userID, emojiID
	return s.unfavoriteErr
}

func newEmojiTestBot(t *testing.T) *domainchat.Bot {
	t.Helper()
	bot, _, err := domainchat.NewBot(domainshared.NewID(), domainshared.NewID(), "emoji bot", nil, time.Now())
	require.NoError(t, err)
	return bot
}

func emojiTestRouter(bot *domainchat.Bot, handler *BotHandler) http.Handler {
	router := chi.NewRouter()
	router.Use(middleware.BotAuth(commandBotLookup{"token": bot}))
	router.Get("/emojis", handler.ListEmojis)
	router.Post("/emojis/{customEmojiId}/favorite", handler.FavoriteEmoji)
	router.Delete("/emojis/{customEmojiId}/favorite", handler.UnfavoriteEmoji)
	return router
}

func TestListEmojisReturnsSystemTokensAndCustomLibrary(t *testing.T) {
	bot := newEmojiTestBot(t)
	ownedID, favoritedID := domainshared.NewID(), domainshared.NewID()
	catalog := &stubBotEmojiCatalog{groups: []appmedia.EmojiGroupDTO{{
		ID: 1, Name: "小电视",
		Emojis: []appmedia.EmojiDTO{{ID: 2, Name: "doge", Token: "[doge]", URL: "/uploads/emojis/doge.png"}},
	}}}
	library := &stubBotCustomEmojiLibrary{mine: appcustomemoji.MineDTO{
		Owned: []appcustomemoji.CustomEmojiDTO{{ID: ownedID.String(), Name: "mine", URL: "/uploads/custom/mine.png"}},
		Favorited: []appcustomemoji.CustomEmojiDTO{
			{ID: favoritedID.String(), Name: "[cat]", URL: "/uploads/custom/cat.png"},
			{ID: ownedID.String(), Name: "mine", URL: "/uploads/custom/mine.png"},
		},
	}}
	handler := NewBotHandler(nil, nil, nil, nil, 0).WithEmojiCatalog(catalog, library)

	req := httptest.NewRequest(http.MethodGet, "/emojis", nil)
	req.Header.Set("Authorization", "Bearer token")
	res := httptest.NewRecorder()
	emojiTestRouter(bot, handler).ServeHTTP(res, req)

	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	var body struct {
		Data botEmojiCatalogDTO `json:"data"`
	}
	require.NoError(t, json.NewDecoder(res.Body).Decode(&body))
	require.Len(t, body.Data.Groups, 1)
	require.Equal(t, "[doge]", body.Data.Groups[0].Emojis[0].Token)
	require.Len(t, body.Data.Custom, 2, "favorited 中的重复项须按 owned 去重")
	require.Equal(t, botCustomEmojiDTO{
		ID: ownedID.String(), Name: "mine",
		Token: "[mine:" + ownedID.String() + "]", URL: "/uploads/custom/mine.png", Source: "owned",
	}, body.Data.Custom[0])
	require.Equal(t, botCustomEmojiDTO{
		ID: favoritedID.String(), Name: "[cat]",
		Token: "[[cat]:" + favoritedID.String() + "]", URL: "/uploads/custom/cat.png", Source: "favorited",
	}, body.Data.Custom[1])
}

func TestFavoriteEmojiUsesBotUser(t *testing.T) {
	bot := newEmojiTestBot(t)
	emojiID := domainshared.NewID()
	library := &stubBotCustomEmojiLibrary{}
	handler := NewBotHandler(nil, nil, nil, nil, 0).WithEmojiCatalog(&stubBotEmojiCatalog{}, library)

	req := httptest.NewRequest(http.MethodPost, "/emojis/"+emojiID.String()+"/favorite", nil)
	req.Header.Set("Authorization", "Bearer token")
	res := httptest.NewRecorder()
	emojiTestRouter(bot, handler).ServeHTTP(res, req)

	require.Equal(t, http.StatusNoContent, res.Code, res.Body.String())
	require.True(t, library.actor.Equal(bot.UserID()))
	require.True(t, library.favoritedID.Equal(emojiID))
}

func TestUnfavoriteEmojiUsesBotUser(t *testing.T) {
	bot := newEmojiTestBot(t)
	emojiID := domainshared.NewID()
	library := &stubBotCustomEmojiLibrary{}
	handler := NewBotHandler(nil, nil, nil, nil, 0).WithEmojiCatalog(&stubBotEmojiCatalog{}, library)

	req := httptest.NewRequest(http.MethodDelete, "/emojis/"+emojiID.String()+"/favorite", nil)
	req.Header.Set("Authorization", "Bearer token")
	res := httptest.NewRecorder()
	emojiTestRouter(bot, handler).ServeHTTP(res, req)

	require.Equal(t, http.StatusNoContent, res.Code, res.Body.String())
	require.True(t, library.actor.Equal(bot.UserID()))
	require.True(t, library.unfavoritedID.Equal(emojiID))
}

func TestEmojiEndpointsRequireBotAuth(t *testing.T) {
	handler := NewBotHandler(nil, nil, nil, nil, 0).WithEmojiCatalog(&stubBotEmojiCatalog{}, &stubBotCustomEmojiLibrary{})
	router := emojiTestRouter(newEmojiTestBot(t), handler)

	for _, req := range []*http.Request{
		httptest.NewRequest(http.MethodGet, "/emojis", nil),
		httptest.NewRequest(http.MethodPost, "/emojis/"+domainshared.NewID().String()+"/favorite", nil),
	} {
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		require.Equal(t, http.StatusUnauthorized, res.Code)
	}
}

func TestEmojiEndpointsWithoutServicesFailClosed(t *testing.T) {
	handler := NewBotHandler(nil, nil, nil, nil, 0)
	router := emojiTestRouter(newEmojiTestBot(t), handler)
	emojiID := domainshared.NewID().String()

	for _, req := range []*http.Request{
		httptest.NewRequest(http.MethodGet, "/emojis", nil),
		httptest.NewRequest(http.MethodPost, "/emojis/"+emojiID+"/favorite", nil),
		httptest.NewRequest(http.MethodDelete, "/emojis/"+emojiID+"/favorite", nil),
	} {
		req.Header.Set("Authorization", "Bearer token")
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		require.Equal(t, http.StatusInternalServerError, res.Code, res.Body.String())
	}
}

func TestFavoriteEmojiRejectsMalformedID(t *testing.T) {
	library := &stubBotCustomEmojiLibrary{}
	handler := NewBotHandler(nil, nil, nil, nil, 0).WithEmojiCatalog(&stubBotEmojiCatalog{}, library)

	req := httptest.NewRequest(http.MethodPost, "/emojis/not-a-uuid/favorite", nil)
	req.Header.Set("Authorization", "Bearer token")
	res := httptest.NewRecorder()
	emojiTestRouter(newEmojiTestBot(t), handler).ServeHTTP(res, req)

	require.Equal(t, http.StatusBadRequest, res.Code, res.Body.String())
	require.True(t, library.favoritedID.IsZero())
}

func TestEmojiErrorsPropagate(t *testing.T) {
	bot := newEmojiTestBot(t)
	emojiID := domainshared.NewID()
	h := func(library *stubBotCustomEmojiLibrary, catalog *stubBotEmojiCatalog) *BotHandler {
		return NewBotHandler(nil, nil, nil, nil, 0).WithEmojiCatalog(catalog, library)
	}
	cases := []struct {
		name    string
		handler *BotHandler
		method  string
		path    string
		status  int
	}{
		{"catalog error", h(&stubBotCustomEmojiLibrary{}, &stubBotEmojiCatalog{err: domainshared.Internal("目录读取失败", nil)}), http.MethodGet, "/emojis", http.StatusInternalServerError},
		{"library error", h(&stubBotCustomEmojiLibrary{listErr: domainshared.Internal("收藏读取失败", nil)}, &stubBotEmojiCatalog{}), http.MethodGet, "/emojis", http.StatusInternalServerError},
		{"unknown emoji", h(&stubBotCustomEmojiLibrary{favoriteErr: domainshared.NotFound("自定义表情不存在")}, &stubBotEmojiCatalog{}), http.MethodPost, "/emojis/" + emojiID.String() + "/favorite", http.StatusNotFound},
		{"own emoji", h(&stubBotCustomEmojiLibrary{favoriteErr: domainshared.Forbidden("不能收藏自己上传的表情")}, &stubBotEmojiCatalog{}), http.MethodPost, "/emojis/" + emojiID.String() + "/favorite", http.StatusForbidden},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			req.Header.Set("Authorization", "Bearer token")
			res := httptest.NewRecorder()
			emojiTestRouter(bot, tc.handler).ServeHTTP(res, req)
			require.Equal(t, tc.status, res.Code, res.Body.String())
		})
	}
}
