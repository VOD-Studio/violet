package chat

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	appchat "blog-api/internal/application/chat"
	domainchat "blog-api/internal/domain/chat"
	domainshared "blog-api/internal/domain/shared"
	"blog-api/internal/interfaces/http/response"
)

const maxBotCommandCatalogBytes = 64 << 10

func (h *Handler) WithBotCommands(commands *appchat.BotCommandService) *Handler {
	h.commands = commands
	return h
}

func (h *BotHandler) WithBotCommands(commands *appchat.BotCommandService) *BotHandler {
	h.commands = commands
	return h
}

// ListBotCommands 返回当前会话中启用 bot 发布的目录。
func (h *Handler) ListBotCommands(w http.ResponseWriter, r *http.Request) {
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
	dto, err := h.commands.ListBotCommands(r.Context(), userID, conversationID)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, dto)
}

// PutCommands 整体替换当前 Bot Token 所属 bot 的目录。
func (h *BotHandler) PutCommands(w http.ResponseWriter, r *http.Request) {
	bot, err := h.requireBot(r)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBotCommandCatalogBytes+1))
	if err != nil || len(body) > maxBotCommandCatalogBytes {
		response.RespondError(w, r, domainshared.BadRequest("命令目录请求体过大或无法读取"))
		return
	}
	var req struct {
		SchemaVersion int                     `json:"schema_version"`
		Commands      []domainchat.BotCommand `json:"commands"`
	}
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil || decoder.Decode(&struct{}{}) != io.EOF || req.Commands == nil {
		response.RespondError(w, r, domainshared.BadRequest("命令目录请求体格式非法"))
		return
	}
	revision, err := h.commands.PublishBotCommands(r.Context(), bot, req.SchemaVersion, req.Commands)
	if err != nil {
		response.RespondError(w, r, err)
		return
	}
	response.RespondOK(w, map[string]string{"revision": revision})
}
