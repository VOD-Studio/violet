package chat

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	appchat "blog-api/internal/application/chat"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
	"blog-api/internal/middleware"
	"github.com/go-chi/chi/v5"
)

// Handler 聊天 HTTP 适配器。
type Handler struct {
	svc *appchat.Service
}

// NewHandler 构造聊天 handler。
func NewHandler(svc *appchat.Service) *Handler { return &Handler{svc: svc} }

// ListConversations 列出当前用户会话。
func (h *Handler) ListConversations(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	result, err := h.svc.ListConversations(r.Context(), userID, r.URL.Query().Get("cursor"), response.ParseLimit(r, 20, 50))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCursor(w, result.Items, response.ParseLimit(r, 20, 50), result.HasMore, result.NextCursor)
}

// CreateConversation 创建私聊或私有房间。
func (h *Handler) CreateConversation(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req struct {
		Kind           string   `json:"kind" validate:"required"`
		Title          string   `json:"title"`
		ParticipantIDs []string `json:"participant_ids"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	participants, err := parseIDs(req.ParticipantIDs)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.CreateConversation(r.Context(), appchat.CreateConversationInput{UserID: userID, Kind: domainchat.ConversationKind(req.Kind), Title: req.Title, ParticipantIDs: participants})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// GetConversation 获取会话详情。
func (h *Handler) GetConversation(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.GetConversation(r.Context(), userID, conversationID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// RenameConversation 修改房间名称。
func (h *Handler) RenameConversation(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req struct {
		Title string `json:"title" validate:"required"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.svc.RenameConversation(r.Context(), appchat.RenameConversationInput{UserID: userID, ConversationID: conversationID, Title: req.Title})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// ListMembers 列出当前有效成员。
func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	members, err := h.svc.ListMembers(r.Context(), userID, conversationID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, members)
}

// InviteMember 邀请成员加入房间。
func (h *Handler) InviteMember(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req struct {
		UserID string `json:"user_id" validate:"required"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	inviteeID, err := parsePathID(req.UserID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.InviteMember(r.Context(), userID, conversationID, inviteeID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusCreated, "成员已加入房间")
}

// RemoveMember 房主移除成员。
func (h *Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	targetID, err := parsePathID(chi.URLParam(r, "userId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.RemoveMember(r.Context(), userID, conversationID, targetID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

// LeaveConversation 当前用户离开会话。
func (h *Handler) LeaveConversation(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.LeaveConversation(r.Context(), userID, conversationID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

// ListMessages 列出会话消息历史。
func (h *Handler) ListMessages(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	result, err := h.svc.ListMessages(r.Context(), userID, conversationID, r.URL.Query().Get("cursor"), response.ParseLimit(r, 20, 50))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCursor(w, result.Items, response.ParseLimit(r, 20, 50), result.HasMore, result.NextCursor)
}

// ListMessageReactions 获取聊天消息反应。
func (h *Handler) ListMessageReactions(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	messageID, err := parsePathID(chi.URLParam(r, "messageId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	reactions, err := h.svc.ListMessageReactions(r.Context(), userID, conversationID, messageID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, reactions)
}

// AddMessageReaction 添加聊天消息反应。
func (h *Handler) AddMessageReaction(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	messageID, err := parsePathID(chi.URLParam(r, "messageId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req struct {
		EmojiID int32 `json:"emoji_id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.AddMessageReaction(r.Context(), appchat.AddMessageReactionInput{
		UserID: userID, ConversationID: conversationID, MessageID: messageID, EmojiID: req.EmojiID,
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusOK, "反应已添加")
}

// RemoveMessageReaction 移除聊天消息反应。
func (h *Handler) RemoveMessageReaction(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	messageID, err := parsePathID(chi.URLParam(r, "messageId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	emojiID, err := strconv.Atoi(chi.URLParam(r, "emojiId"))
	if err != nil {
		response.RespondError(w, r, domainshared.BadRequest("表情 ID 无效"))
		return
	}
	if err := h.svc.RemoveMessageReaction(r.Context(), appchat.RemoveMessageReactionInput{
		UserID: userID, ConversationID: conversationID, MessageID: messageID, EmojiID: int32(emojiID),
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

// SendMessage 发送文本或图片消息。
func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req struct {
		Type          string `json:"type" validate:"required"`
		Content       string `json:"content"`
		MediaID       string `json:"media_id"`
		SharedTweetID string `json:"shared_tweet_id"`
		ReplyToID     string `json:"reply_to_id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	var mediaID, sharedTweetID, replyToID domainshared.ID
	if req.MediaID != "" {
		mediaID, err = parsePathID(req.MediaID)
		if err != nil {
			response.RespondError(w, r, err)
			return
		}
	}
	if req.SharedTweetID != "" {
		sharedTweetID, err = parsePathID(req.SharedTweetID)
		if err != nil {
			response.RespondError(w, r, err)
			return
		}
	}
	if req.ReplyToID != "" {
		replyToID, err = parsePathID(req.ReplyToID)
		if err != nil {
			response.RespondError(w, r, err)
			return
		}
	}
	dto, err := h.svc.SendMessage(r.Context(), appchat.SendMessageInput{UserID: userID, ConversationID: conversationID, Type: domainchat.MessageType(req.Type), Content: req.Content, MediaID: mediaID, SharedTweetID: sharedTweetID, ReplyToID: replyToID, IdempotencyKey: strings.TrimSpace(r.Header.Get("Idempotency-Key"))})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// MarkRead 更新会话阅读位置。
func (h *Handler) MarkRead(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req struct {
		MessageID string `json:"message_id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	var messageID domainshared.ID
	if req.MessageID != "" {
		messageID, err = parsePathID(req.MessageID)
		if err != nil {
			response.RespondError(w, r, err)
			return
		}
	}
	unread, err := h.svc.MarkRead(r.Context(), userID, conversationID, messageID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"conversation_id": conversationID.String(), "unread_count": unread})
}

// SetMuted 更新当前用户的会话通知静音状态。
func (h *Handler) SetMuted(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req struct {
		Muted bool `json:"muted"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.SetConversationMuted(r.Context(), userID, conversationID, req.Muted); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"conversation_id": conversationID.String(), "is_muted": req.Muted})
}

// SetTyping 上报当前用户在会话中的输入状态。
func (h *Handler) SetTyping(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req struct {
		IsTyping bool `json:"is_typing"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.SetTyping(r.Context(), appchat.SetTypingInput{UserID: userID, ConversationID: conversationID, IsTyping: req.IsTyping}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

// DeleteMessage 管理员删除违规消息。
func (h *Handler) DeleteMessage(w http.ResponseWriter, r *http.Request) {
	adminID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	messageID, err := parsePathID(chi.URLParam(r, "messageId"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.DeleteMessage(r.Context(), adminID, conversationID, messageID); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

// FindUserByUsername 精确查询可聊天用户。
func (h *Handler) FindUserByUsername(w http.ResponseWriter, r *http.Request) {
	dto, err := h.svc.FindUserByUsername(r.Context(), chi.URLParam(r, "username"))
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// ListContacts 返回当前用户可发起私聊的联系人。
func (h *Handler) ListContacts(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	limit := response.ParseLimit(r, 20, 50)
	result, err := h.svc.ListContacts(r.Context(), userID, r.URL.Query().Get("q"), r.URL.Query().Get("cursor"), limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCursor(w, result.Items, limit, result.HasMore, result.NextCursor)
}

// UnreadCount 返回当前用户全部未读数。
func (h *Handler) UnreadCount(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	count, err := h.svc.UnreadCount(r.Context(), userID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]any{"unread_count": count})
}

// PushConfig 返回 Web Push 公钥。
func (h *Handler) PushConfig(w http.ResponseWriter, _ *http.Request) {
	response.RespondOK(w, map[string]any{"public_key": h.svc.PushPublicKey(), "enabled": h.svc.PushPublicKey() != ""})
}

// SavePushSubscription 保存浏览器推送订阅。
func (h *Handler) SavePushSubscription(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req struct {
		Endpoint string `json:"endpoint" validate:"required"`
		Keys     struct {
			P256DH string `json:"p256dh" validate:"required"`
			Auth   string `json:"auth" validate:"required"`
		} `json:"keys"`
		ShowPreview bool `json:"show_preview"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.SavePushSubscription(r.Context(), userID, req.Endpoint, req.Keys.P256DH, req.Keys.Auth, r.UserAgent(), req.ShowPreview); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondMessage(w, http.StatusCreated, "浏览器通知已启用")
}

// DeletePushSubscription 删除浏览器推送订阅。
func (h *Handler) DeletePushSubscription(w http.ResponseWriter, r *http.Request) {
	userID, err := currentUserID(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req struct {
		Endpoint string `json:"endpoint" validate:"required"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if err := h.svc.DeletePushSubscription(r.Context(), userID, req.Endpoint); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

func currentUserID(r *http.Request) (domainshared.ID, error) {
	value := middleware.GetUserID(r.Context())
	if value == "" {
		return domainshared.ID{}, domainshared.Unauthorized("请先登录")
	}
	return domainshared.ParseID(value)
}

func parsePathID(value string) (domainshared.ID, error) {
	id, err := domainshared.ParseID(strings.TrimSpace(value))
	if err != nil {
		return domainshared.ID{}, domainshared.BadRequest("ID 格式非法")
	}
	return id, nil
}

func parseIDs(values []string) ([]domainshared.ID, error) {
	ids := make([]domainshared.ID, 0, len(values))
	for _, value := range values {
		id, err := parsePathID(value)
		if err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
	if err := decoder.Decode(target); err != nil {
		return domainshared.BadRequest("请求体格式非法")
	}
	return nil
}
