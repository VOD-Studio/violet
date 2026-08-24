// Package customemoji 提供自定义表情模块的 HTTP handler。
package customemoji

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	appcustomemoji "blog-api/internal/application/customemoji"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
	"blog-api/internal/middleware"
)

// customEmojiService 抽出的窄接口，供 handler 依赖倒置、便于 stub 测试
// （与 comment handler 的 commentService 接口同构）。
type customEmojiService interface {
	Create(ctx context.Context, in appcustomemoji.CreateInput) (appcustomemoji.CustomEmojiDTO, error)
	ListMine(ctx context.Context, userID domainshared.ID) (appcustomemoji.MineDTO, error)
	Delete(ctx context.Context, emojiID domainshared.ID) error
	Favorite(ctx context.Context, userID, emojiID domainshared.ID) error
	Unfavorite(ctx context.Context, userID, emojiID domainshared.ID) error
}

// Handler 自定义表情 HTTP 处理器
type Handler struct {
	svc customEmojiService
}

// NewHandler 创建自定义表情 handler
func NewHandler(svc customEmojiService) *Handler {
	return &Handler{svc: svc}
}

// createRequest POST /custom-emojis 请求体。
type createRequest struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// Create 上传自定义表情：POST /custom-emojis
// url 来自已有 POST /uploads/emoji 上传结果，本端点不新增上传逻辑。
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.Create(r.Context(), appcustomemoji.CreateInput{OwnerID: userID, Name: req.Name, URL: req.URL})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// ListMine 我的表情（自传+收藏）：GET /custom-emojis/mine
func (h *Handler) ListMine(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.ListMine(r.Context(), userID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// Delete 删除自定义表情：DELETE /custom-emojis/{id}
// 鉴权（owner 本人或 customemoji:manage）在 application 层判定，本 handler 仅登录校验。
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := parsePathID(r.PathValue("id"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.Delete(r.Context(), id); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "表情已删除")
}

// Favorite 收藏表情：POST /custom-emojis/{id}/favorite
func (h *Handler) Favorite(w http.ResponseWriter, r *http.Request) {
	userID, emojiID, err := h.parseUserAndEmojiID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.Favorite(r.Context(), userID, emojiID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "已收藏")
}

// Unfavorite 移出收藏：DELETE /custom-emojis/{id}/favorite
func (h *Handler) Unfavorite(w http.ResponseWriter, r *http.Request) {
	userID, emojiID, err := h.parseUserAndEmojiID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.Unfavorite(r.Context(), userID, emojiID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "已移出收藏")
}

func (h *Handler) parseUserAndEmojiID(r *http.Request) (userID, emojiID domainshared.ID, err error) {
	userID, err = currentUserID(r)
	if err != nil {
		return domainshared.ID{}, domainshared.ID{}, err
	}
	emojiID, err = parsePathID(r.PathValue("id"))
	if err != nil {
		return domainshared.ID{}, domainshared.ID{}, err
	}
	return userID, emojiID, nil
}

// currentUserID 从登录态上下文解析当前用户 ID（同 chat handler 的写法）。
func currentUserID(r *http.Request) (domainshared.ID, error) {
	value := middleware.GetUserID(r.Context())
	if value == "" {
		return domainshared.ID{}, domainshared.Unauthorized("请先登录")
	}
	return domainshared.ParseID(value)
}

// parsePathID 解析路径参数 ID，格式非法返回 400（同 chat handler 的写法）。
func parsePathID(value string) (domainshared.ID, error) {
	id, err := domainshared.ParseID(strings.TrimSpace(value))
	if err != nil {
		return domainshared.ID{}, domainshared.BadRequest("ID 格式非法")
	}
	return id, nil
}
