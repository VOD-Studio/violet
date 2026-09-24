package chat

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	appchat "blog-api/internal/application/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

// BotAdminHandler bot 凭证的后台管理适配器（/admin/chat/bots）。
//
// 与 Bot API 分属两套鉴权：这里走 session + chat:bot-manage 权限点，
// 面向的是站务人员；Bot API 走 Bearer token，面向外部程序。
type BotAdminHandler struct {
	bots *appchat.BotService
}

// NewBotAdminHandler 构造 bot 管理 handler。
func NewBotAdminHandler(svc *appchat.BotService) *BotAdminHandler {
	return &BotAdminHandler{bots: svc}
}

type createBotRequest struct {
	// Name 显示名，同时作为虚拟用户的展示名。
	Name string `json:"name" validate:"required,max=32"`
	// Username 虚拟用户名：3-32 位字母、数字、下划线或连字符，全站唯一，@提及用它寻址。
	Username string `json:"username" validate:"required"`
	// AvatarID 头像文件 ID，可空。
	AvatarID string `json:"avatar_id"`
}

type updateBotRequest struct {
	Name *string `json:"name"`
	// AvatarID 传空串清除头像，字段缺省表示不改。
	AvatarID                *string `json:"avatar_id"`
	Enabled                 *bool   `json:"enabled"`
	ShowThinking            *bool   `json:"show_thinking"`
	ThinkingDefaultExpanded *bool   `json:"thinking_default_expanded"`
}

// List 分页列出 bot。
func (h *BotAdminHandler) List(w http.ResponseWriter, r *http.Request) {
	result, err := h.bots.ListBots(r.Context(), response.ParsePageQuery(r))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondPaged(w, result.Items, result.Page, result.Limit, result.Total)
}

// Create 注册 bot。响应里的 token 是刚签发的明文，后台之后可随时回看。
func (h *BotAdminHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createBotRequest
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	var avatarID domainshared.ID
	if trimmed := strings.TrimSpace(req.AvatarID); trimmed != "" {
		parsed, err := parsePathID(trimmed)
		if err != nil {
			response.RespondError(w, r, err)
			return
		}
		avatarID = parsed
	}
	dto, err := h.bots.CreateBot(r.Context(), appchat.CreateBotInput{
		Name:     req.Name,
		Username: req.Username,
		AvatarID: avatarID,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// Update 修改 Bot 资料与展示配置。
func (h *BotAdminHandler) Update(w http.ResponseWriter, r *http.Request) {
	botID, err := parsePathID(chi.URLParam(r, "botId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req updateBotRequest
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.bots.UpdateBot(r.Context(), appchat.UpdateBotInput{
		ID:                      botID,
		Name:                    req.Name,
		AvatarID:                req.AvatarID,
		Enabled:                 req.Enabled,
		ShowThinking:            req.ShowThinking,
		ThinkingDefaultExpanded: req.ThinkingDefaultExpanded,
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// RegenerateToken 重置 token，旧 token 即刻失效。
func (h *BotAdminHandler) RegenerateToken(w http.ResponseWriter, r *http.Request) {
	botID, err := parsePathID(chi.URLParam(r, "botId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.bots.RegenerateToken(r.Context(), botID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// RevealToken 回显 bot 当前的明文 token（后台「查看凭据」）。
//
// 取而不改，但走 POST 而非 GET：凭据出现在 URL 里会被浏览器历史与反代理访问日志拓下来。
func (h *BotAdminHandler) RevealToken(w http.ResponseWriter, r *http.Request) {
	botID, err := parsePathID(chi.URLParam(r, "botId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.bots.RevealToken(r.Context(), botID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// Delete 吊销 bot 凭证并停用其虚拟用户。
func (h *BotAdminHandler) Delete(w http.ResponseWriter, r *http.Request) {
	botID, err := parsePathID(chi.URLParam(r, "botId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.bots.DeleteBot(r.Context(), botID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "Bot 已吊销")
}
