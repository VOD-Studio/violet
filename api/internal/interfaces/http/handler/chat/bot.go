package chat

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	appchat "blog-api/internal/application/chat"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
	"blog-api/internal/middleware"
)

// BotHandler 面向外部 bot 的聊天 HTTP 适配器（/api/v1/chat/bot/*）。
//
// 全部端点由 BotAuth 中间件注入 bot 身份，之后以 bot 的虚拟用户 ID 复用人类侧的
// chat.Service 用例：成员校验、mention 解析、消息持久化与 SSE 推送走同一条链路，
// 服务层不存在 bot 专用第二套实现。
type BotHandler struct {
	chat     *appchat.Service
	bots     *appchat.BotService
	conns    *appchat.BotConnectionManager
	commands *appchat.BotCommandService
}

// NewBotHandler 构造 bot 聊天适配器。conns 为 nil 时事件流端点不可用。
func NewBotHandler(chatSvc *appchat.Service, botSvc *appchat.BotService, conns *appchat.BotConnectionManager) *BotHandler {
	return &BotHandler{chat: chatSvc, bots: botSvc, conns: conns}
}

// requireBot 取出当前请求的 bot。中间件已鉴权，此处只防路由漏挂 BotAuth。
func (h *BotHandler) requireBot(r *http.Request) (*domainchat.Bot, error) {
	bot := middleware.GetBot(r.Context())
	if bot == nil {
		return nil, domainshared.Unauthorized("缺少或无效的 Bot Token")
	}
	return bot, nil
}

// Profile 返回本 bot 的身份资料。
//
// bot 需要它来判定「这条消息是不是我自己发的」以及被 @ 的是不是自己，
// 否则只能靠解析 token 反推，等于把身份判定推给每个外部实现。
func (h *BotHandler) Profile(w http.ResponseWriter, r *http.Request) {
	bot, err := h.requireBot(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.bots.BotProfile(r.Context(), bot)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// ListConversations 列出本 bot 参与的会话。
func (h *BotHandler) ListConversations(w http.ResponseWriter, r *http.Request) {
	bot, err := h.requireBot(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	limit := response.ParseLimit(r, 20, 50)
	result, err := h.chat.ListConversations(r.Context(), bot.UserID(), r.URL.Query().Get("cursor"), limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCursor(w, result.Items, limit, result.HasMore, result.NextCursor)
}

// GetConversation 获取会话详情。
func (h *BotHandler) GetConversation(w http.ResponseWriter, r *http.Request) {
	bot, conversationID, err := h.botConversation(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	dto, err := h.chat.GetConversation(r.Context(), bot.UserID(), conversationID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// ListMessages 分页拉取会话历史。
//
// 也是 bot 断线后的恢复通道：事件流不补发，重连后按 created_at 拉齐缺的消息。
func (h *BotHandler) ListMessages(w http.ResponseWriter, r *http.Request) {
	bot, conversationID, err := h.botConversation(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	limit := response.ParseLimit(r, 20, 50)
	result, err := h.chat.ListMessages(r.Context(), bot.UserID(), conversationID, r.URL.Query().Get("cursor"), limit)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCursor(w, result.Items, limit, result.HasMore, result.NextCursor)
}

// SendMessage 以 bot 身份发消息。
//
// 只开放文本：图片与分享推文涉及媒体归属与引用校验，bot 侧没有对应上传通道，
// 提前留口子只会变成没人鉴权的入口。
// Idempotency-Key 必填——外部程序重试是同一条消息，重试两次不该刷两遍屏。
func (h *BotHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	bot, conversationID, err := h.botConversation(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	var req struct {
		Content   string `json:"content"`
		ReplyToID string `json:"reply_to_id"`
		Status    string `json:"status"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	if req.Status != "" && req.Status != string(domainchat.BotReplyPending) {
		response.RespondError(w, r, domainshared.BadRequest("创建时只能设置 pending 状态"))
		return
	}
	var replyToID domainshared.ID
	if strings.TrimSpace(req.ReplyToID) != "" {
		replyToID, err = parsePathID(req.ReplyToID)
		if err != nil {
			response.RespondError(w, r, err)
			return
		}
	}
	dto, err := h.chat.SendBotMessage(r.Context(), appchat.SendMessageInput{
		UserID:         bot.UserID(),
		ConversationID: conversationID,
		Type:           domainchat.MessageText,
		Content:        req.Content,
		ReplyToID:      replyToID,
		IdempotencyKey: strings.TrimSpace(r.Header.Get("Idempotency-Key")),
		BotPending:     req.Status == string(domainchat.BotReplyPending),
	})
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondCreated(w, dto)
}

// EditMessage 编辑自己发过的消息。
//
// 旧协议反复编辑正文；生成协议按 revision 提交累计快照和状态。
// 归属校验由 chat.Service 的「只能编辑自己的消息」承担，传进去的 UserID
// 就是本 bot 的虚拟用户，编辑别人的消息天然是 403。
func (h *BotHandler) EditMessage(w http.ResponseWriter, r *http.Request) {
	bot, conversationID, err := h.botConversation(r)
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
		Content  string `json:"content"`
		Thinking string `json:"thinking"`
		Status   string `json:"status"`
		Revision int64  `json:"revision"`
	}
	if err := decodeJSON(r, &req); err != nil {
		response.RespondError(w, r, err)
		return
	}
	var dto appchat.MessageDTO
	if req.Status != "" {
		dto, err = h.chat.UpdateBotReply(r.Context(), appchat.UpdateBotReplyInput{
			UserID: bot.UserID(), ConversationID: conversationID, MessageID: messageID,
			Content: req.Content, Thinking: req.Thinking, Status: domainchat.BotReplyStatus(req.Status), Revision: req.Revision,
		})
	} else {
		dto, err = h.chat.EditMessage(r.Context(), appchat.EditMessageInput{
			UserID: bot.UserID(), ConversationID: conversationID, MessageID: messageID, Content: req.Content,
		})
	}
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// SetTyping 上报输入状态。
func (h *BotHandler) SetTyping(w http.ResponseWriter, r *http.Request) {
	bot, conversationID, err := h.botConversation(r)
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
	if err := h.chat.SetTyping(r.Context(), appchat.SetTypingInput{
		UserID:         bot.UserID(),
		ConversationID: conversationID,
		IsTyping:       req.IsTyping,
	}); err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondNoContent(w)
}

// Stream bot 事件 SSE 流。
//
// 与用户侧 /chat/events 的关键差别：不做 Last-Event-ID 补发。bot 收到的事件自带
// 消息全文，而补发通道（chat_events）存的是给用户端看的引用形态，两套形状凑在
// 一条流上只会让外部实现两边都要兼容。断线恢复走 ListMessages。
func (h *BotHandler) Stream(w http.ResponseWriter, r *http.Request) {
	bot, err := h.requireBot(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	if h.conns == nil {
		response.RespondError(w, r, domainshared.Internal("Bot 事件流未启用", nil))
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		response.RespondError(w, r, fmt.Errorf("当前响应不支持 SSE"))
		return
	}
	ch, cleanup := h.conns.Register(bot.ID())
	defer cleanup()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	// 立即 flush 一帧注释行：让客户端在 accept 阶段就拿到首个字节，
	// 不必等到第一条真实事件才知道流已建立。
	_, _ = fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case event, open := <-ch:
			if !open {
				return
			}
			writeBotEvent(w, event)
			flusher.Flush()
		case <-ticker.C:
			_, _ = fmt.Fprint(w, ": heartbeat\n\n")
			flusher.Flush()
		}
	}
}

// botConversation 取出 bot 与路径上的会话 ID。会话成员校验留给 chat.Service，
// 不在 handler 里另判一次（两处判定必然漂移）。
func (h *BotHandler) botConversation(r *http.Request) (*domainchat.Bot, domainshared.ID, error) {
	bot, err := h.requireBot(r)
	if err != nil {
		return nil, domainshared.ID{}, err
	}
	conversationID, err := parsePathID(chi.URLParam(r, "conversationId"))
	if err != nil {
		return nil, domainshared.ID{}, err
	}
	return bot, conversationID, nil
}

// writeBotEvent 写一帧 bot SSE。事件名用事件类型（message.created、typing.updated），
// 外部实现按事件名分派即可，不必再解 data.type。ID 恒为空，故不写 `id:` 行。
func writeBotEvent(w http.ResponseWriter, event appchat.EventDTO) {
	_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, appchat.MarshalEvent(event))
}
