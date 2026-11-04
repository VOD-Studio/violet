package routing

import "github.com/go-chi/chi/v5"

// registerTweetBotRoutes 注册 Bot 推文 API：外部 bot 以 Bearer token 发布推文、
// 评论、点赞与删除自己的内容。
//
// 与 /chat/bot 同策略挂在根 router：v1 组对写操作校验 CSRF 的 cookie+header 配对，
// bot 不带 cookie，只能在 CSRF 之外鉴权。写操作按 bot 虚拟用户维度限流——
// 多个 bot 常从同一台服务器出口进来，按 IP 计会互相挤占配额。
func registerTweetBotRoutes(r chi.Router, d *Deps) {
	h := d.TweetBot
	r.Route("/api/v1/tweets/bot", func(br chi.Router) {
		br.Use(d.BotAuth)
		br.With(d.limit("tweet-bot", "POST /api/v1/tweets/bot")).Post("/", h.Create)
		br.With(d.limit("tweet-bot-media", "POST /api/v1/tweets/bot/media")).Post("/media", h.UploadMedia)
		br.With(d.limit("tweet-bot-comment", "POST /api/v1/tweets/bot/{tweetId}/comments")).
			Post("/{tweetId}/comments", h.CreateComment)
		br.With(d.limit("tweet-bot-comment", "DELETE /api/v1/tweets/bot/{tweetId}/comments/{commentId}")).
			Delete("/{tweetId}/comments/{commentId}", h.DeleteComment)
		br.With(d.limit("tweet-bot-like", "POST /api/v1/tweets/bot/{tweetId}/like")).
			Post("/{tweetId}/like", h.Like)
		br.With(d.limit("tweet-bot-like", "DELETE /api/v1/tweets/bot/{tweetId}/like")).
			Delete("/{tweetId}/like", h.Unlike)
		br.With(d.limit("tweet-bot-delete", "DELETE /api/v1/tweets/bot/{tweetId}")).
			Delete("/{tweetId}", h.Delete)
	})
}
