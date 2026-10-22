package routing

import "github.com/go-chi/chi/v5"

// registerBotRoutes 注册 Bot API：外部程序以 Bearer bot token 代表虚拟用户收发消息。
//
// 挂在根 router 而不是 v1 组内：v1 对全部写方法校验 CSRF 的 cookie+header 配对，
// bot 没有 cookie，只能像 MCP 端点那样绕开这层。chi 按最长前缀命中，
// /api/v1/chat/bot/* 不会被 v1 的挂载抢走。
//
// 写操作按 bot 虚拟用户维度限流（不是 IP）：多个 bot 常从同一台服务器出口进来，
// 按 IP 计会让它们互相挤占配额。
func registerBotRoutes(r chi.Router, d *Deps) {
	h := d.ChatBot
	r.Route("/api/v1/chat/bot", func(br chi.Router) {
		br.Use(d.BotAuth)
		br.Get("/profile", h.Profile)
		br.With(d.limit("chat-bot-commands", "PUT /api/v1/chat/bot/commands")).Put("/commands", h.PutCommands)
		br.Get("/events", h.Stream)
		br.With(d.limit("chat-bot-media", "POST /api/v1/chat/bot/media")).Post("/media", h.UploadMedia)
		br.Get("/conversations", h.ListConversations)
		br.Get("/conversations/{conversationId}", h.GetConversation)
		br.Get("/conversations/{conversationId}/messages", h.ListMessages)
		br.With(d.limit("chat-bot-send", "POST /api/v1/chat/bot/conversations/{conversationId}/messages")).
			Post("/conversations/{conversationId}/messages", h.SendMessage)
		// 流式回复靠反复 Edit 推进，配额要比普通编辑宽松。
		br.With(d.limit("chat-bot-edit", "PATCH /api/v1/chat/bot/conversations/{conversationId}/messages/{messageId}")).
			Patch("/conversations/{conversationId}/messages/{messageId}", h.EditMessage)
		br.With(d.limit("chat-bot-typing", "POST /api/v1/chat/bot/conversations/{conversationId}/typing")).
			Post("/conversations/{conversationId}/typing", h.SetTyping)
	})
}
