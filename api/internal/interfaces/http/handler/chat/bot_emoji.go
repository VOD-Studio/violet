package chat

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	appcustomemoji "blog-api/internal/application/customemoji"
	appmedia "blog-api/internal/application/media"
	appshared "blog-api/internal/application/shared"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

// botEmojiCatalogDTO 是 GET /api/v1/chat/bot/emojis 的响应体。
type botEmojiCatalogDTO struct {
	Groups []appmedia.EmojiGroupDTO `json:"groups"`
	Custom []botCustomEmojiDTO      `json:"custom"`
}

// botCustomEmojiDTO 是 bot 可选用的单个自定义表情：token 可直接发进正文。
type botCustomEmojiDTO struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Token  string `json:"token"`
	URL    string `json:"url"`
	Source string `json:"source"` // 'owned'（本 bot 上传，目前恒为空）或 'favorited'
}

// WithEmojiCatalog 注入系统表情目录与 bot 的自定义表情库。
// 不放进 NewBotHandler：既有调用方的测试只关心消息链路，表情能力按需装配。
func (h *BotHandler) WithEmojiCatalog(catalog botEmojiCatalog, custom botCustomEmojiLibrary) *BotHandler {
	h.emojiCatalog = catalog
	h.customEmojis = custom
	return h
}

// ListEmojis 返回系统表情目录与 bot 自己的自定义表情。
//
// token 字段省去外部实现自行拼方括号与 UUID 的环节：系统表情直接发 [name]，
// 自定义表情发 [name:id]。bot 没有独立的自定义表情全集可看——只能看到自己
// 上传和收藏的，与 ADR-0013 的私有默认一致。
func (h *BotHandler) ListEmojis(w http.ResponseWriter, r *http.Request) {
	bot, err := h.requireBot(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if h.emojiCatalog == nil || h.customEmojis == nil {
		response.RespondError(w, r, domainshared.Internal("Bot 表情目录未启用", nil))
		return
	}
	groups, err := h.emojiCatalog.GetAll(r.Context())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	mine, err := h.customEmojis.ListMine(r.Context(), bot.UserID())
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if groups == nil {
		groups = []appmedia.EmojiGroupDTO{}
	}
	custom := make([]botCustomEmojiDTO, 0, len(mine.Owned)+len(mine.Favorited))
	seen := make(map[string]struct{}, len(mine.Owned)+len(mine.Favorited))
	appendEntries := func(entries []appcustomemoji.CustomEmojiDTO, source appcustomemoji.Relation) {
		for _, entry := range entries {
			if _, exists := seen[entry.ID]; exists {
				continue
			}
			id, err := domainshared.ParseID(entry.ID)
			if err != nil {
				continue
			}
			seen[entry.ID] = struct{}{}
			custom = append(custom, botCustomEmojiDTO{
				ID: entry.ID, Name: entry.Name,
				Token:  appshared.FormatCustomEmojiToken(entry.Name, id),
				URL:    entry.URL,
				Source: string(source),
			})
		}
	}
	appendEntries(mine.Owned, appcustomemoji.RelationOwned)
	appendEntries(mine.Favorited, appcustomemoji.RelationFavorited)
	response.RespondOK(w, botEmojiCatalogDTO{Groups: groups, Custom: custom})
}

// FavoriteEmoji 收藏一个自定义表情，此后 bot 才能在自己的消息里发 [name:id]。
//
// 收藏是获取选用权的唯一途径：自定义表情 ID 是随机 UUID，没有全站目录可枚举，
// bot 只能收藏它在聊天/评论/推文里实际见到的表情。
func (h *BotHandler) FavoriteEmoji(w http.ResponseWriter, r *http.Request) {
	h.changeFavorite(w, r, true)
}

// UnfavoriteEmoji 把自定义表情移出 bot 的收藏（幂等）。
func (h *BotHandler) UnfavoriteEmoji(w http.ResponseWriter, r *http.Request) {
	h.changeFavorite(w, r, false)
}

func (h *BotHandler) changeFavorite(w http.ResponseWriter, r *http.Request, favorite bool) {
	bot, err := h.requireBot(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if h.customEmojis == nil {
		response.RespondError(w, r, domainshared.Internal("Bot 自定义表情库未启用", nil))
		return
	}
	emojiID, err := domainshared.ParseID(chi.URLParam(r, "customEmojiId"))
	if err != nil {
		response.RespondError(w, r, domainshared.BadRequest("自定义表情 ID 无效"))
		return
	}
	if favorite {
		err = h.customEmojis.Favorite(r.Context(), bot.UserID(), emojiID)
	} else {
		err = h.customEmojis.Unfavorite(r.Context(), bot.UserID(), emojiID)
	}
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}
