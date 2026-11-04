package tweet

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"

	appmedia "blog-api/internal/application/media"
	apptweet "blog-api/internal/application/tweet"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
	"blog-api/internal/middleware"
)

// botMediaSaver 推文媒体入库端口（upload 域实现）。
type botMediaSaver interface {
	SaveBotTweetImage(context.Context, appmedia.SaveBotMediaInput) (appmedia.BotMediaDTO, error)
}

// BotHandler 面向外部 bot 的推文 HTTP 适配器（/api/v1/tweets/bot/*）。
//
// 作者恒为 BotAuth 注入的虚拟用户；发布复用人类侧 tweet.Service，bot 没有
// 第二套推文链路。写端点要求 Idempotency-Key，重试与首次请求同键同内容。
type BotHandler struct {
	svc           *apptweet.Service
	media         botMediaSaver
	mediaMaxBytes int64
}

// NewBotHandler 构造 bot 推文适配器。media 为 nil 时媒体端点返回 500。
func NewBotHandler(svc *apptweet.Service, media botMediaSaver, mediaMaxBytes int64) *BotHandler {
	return &BotHandler{svc: svc, media: media, mediaMaxBytes: mediaMaxBytes}
}

// requireBot 取出当前请求的 bot。中间件已鉴权，此处只防路由漏挂 BotAuth。
func (h *BotHandler) requireBot(r *http.Request) (*domainchat.Bot, error) {
	bot := middleware.GetBot(r.Context())
	if bot == nil {
		return nil, domainshared.Unauthorized("缺少或无效的 Bot Token")
	}
	return bot, nil
}

// botIdempotencyKey 读取并校验 Idempotency-Key，返回规范化 UUID 串。
func botIdempotencyKey(r *http.Request) (string, error) {
	key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if key == "" {
		return "", domainshared.BadRequest("缺少 Idempotency-Key")
	}
	id, err := domainshared.ParseID(key)
	if err != nil || id.IsZero() {
		return "", domainshared.BadRequest("Idempotency-Key 必须是 UUID")
	}
	return key, nil
}

type botCreateTweetRequest struct {
	Content string   `json:"content"`
	Images  []string `json:"images"`
	QuoteOf *string  `json:"quote_of"`
}

// Create 发推文或引用推文：POST /api/v1/tweets/bot
func (h *BotHandler) Create(w http.ResponseWriter, r *http.Request) {
	bot, err := h.requireBot(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	key, err := botIdempotencyKey(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req botCreateTweetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Create(r.Context(), apptweet.CreateInput{
		AuthorID:        bot.UserID().String(),
		Content:         req.Content,
		Images:          req.Images,
		QuoteOf:         req.QuoteOf,
		ClientRequestID: key,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

type botCreateCommentRequest struct {
	Body     string                  `json:"body"`
	Pictures []apptweet.PictureInput `json:"pictures"`
	ParentID string                  `json:"parent_id"`
}

// CreateComment 评论或回复：POST /api/v1/tweets/bot/{tweetId}/comments
func (h *BotHandler) CreateComment(w http.ResponseWriter, r *http.Request) {
	bot, err := h.requireBot(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	key, err := botIdempotencyKey(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req botCreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.CreateComment(r.Context(), apptweet.CreateCommentInput{
		TweetID:   r.PathValue("tweetId"),
		AuthorID:  bot.UserID().String(),
		Body:      req.Body,
		Pictures:  apptweet.PicturesToDomain(req.Pictures),
		ParentID:  req.ParentID,
		CommentID: key,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// DeleteComment 删除自己的评论：DELETE /api/v1/tweets/bot/{tweetId}/comments/{commentId}
func (h *BotHandler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireBot(r); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.DeleteComment(r.Context(), r.PathValue("commentId")); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "评论已删除")
}

// Like 点赞：POST /api/v1/tweets/bot/{tweetId}/like
func (h *BotHandler) Like(w http.ResponseWriter, r *http.Request) {
	if err := h.likeAction(r, true); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]string{"message": "已点赞"})
}

// Unlike 取消点赞：DELETE /api/v1/tweets/bot/{tweetId}/like
func (h *BotHandler) Unlike(w http.ResponseWriter, r *http.Request) {
	if err := h.likeAction(r, false); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]string{"message": "已取消点赞"})
}

func (h *BotHandler) likeAction(r *http.Request, like bool) error {
	bot, err := h.requireBot(r)
	if err != nil {
		return err
	}
	if like {
		return h.svc.Like(r.Context(), bot.UserID().String(), r.PathValue("tweetId"))
	}
	return h.svc.Unlike(r.Context(), bot.UserID().String(), r.PathValue("tweetId"))
}

// Delete 删除自己的推文：DELETE /api/v1/tweets/bot/{tweetId}
func (h *BotHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if _, err := h.requireBot(r); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.Delete(r.Context(), r.PathValue("tweetId")); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "推文已删除")
}

// UploadMedia 上传一张归当前 bot 所有的推文配图：POST /api/v1/tweets/bot/media
func (h *BotHandler) UploadMedia(w http.ResponseWriter, r *http.Request) {
	bot, err := h.requireBot(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if h.media == nil {
		response.RespondError(w, r, domainshared.Internal("Bot 媒体上传未启用", nil))
		return
	}
	if h.mediaMaxBytes > 0 {
		r.Body = http.MaxBytesReader(w, r.Body, h.mediaMaxBytes+(1<<20))
	}
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			response.RespondPayloadTooLarge(w, r, "图片超过上传大小上限")
			return
		}
		response.RespondError(w, r, domainshared.BadRequest("multipart 请求格式错误"))
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		response.RespondError(w, r, domainshared.BadRequest("缺少图片文件"))
		return
	}
	defer file.Close()

	reader := io.Reader(file)
	if h.mediaMaxBytes > 0 {
		reader = io.LimitReader(file, h.mediaMaxBytes+1)
	}
	data, err := io.ReadAll(reader)
	if err != nil {
		response.RespondError(w, r, domainshared.BadRequest("读取图片失败"))
		return
	}
	if h.mediaMaxBytes > 0 && int64(len(data)) > h.mediaMaxBytes {
		response.RespondPayloadTooLarge(w, r, "图片超过上传大小上限")
		return
	}
	mimeType, _, err := mime.ParseMediaType(header.Header.Get("Content-Type"))
	if err != nil {
		response.RespondError(w, r, domainshared.BadRequest("图片 MIME 类型无效"))
		return
	}
	if mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(data)
	}
	filename := strings.TrimSpace(r.FormValue("filename"))
	if filename == "" {
		filename = header.Filename
	}
	result, err := h.media.SaveBotTweetImage(r.Context(), appmedia.SaveBotMediaInput{
		OwnerID: bot.UserID(), OriginalName: filename, MIMEType: mimeType, Data: data,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, result)
}
