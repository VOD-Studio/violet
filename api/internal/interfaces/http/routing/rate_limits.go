package routing

import (
	"net/http"

	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
	"blog-api/internal/middleware"
)

type rateBinding struct {
	title    string
	identity string
	window   int64
	maximum  int64
}

// 目录定义不代表启用；只有 limit 在实际路由上调用时才注册给运行策略。
var rateBindings = map[string]rateBinding{
	"auth":              {"认证与邮件验证", "ip", 60, 5},
	"comment":           {"评论与评论反应", "ip", 60, 3},
	"comment_code":      {"评论验证码", "ip", 60, 5},
	"upload":            {"文件上传", "ip", 60, 30},
	"tweet":             {"发布推文", "user", 3600, 10},
	"chat_typing":       {"聊天输入状态", "user", 60, 60},
	"code_runner":       {"代码执行", "ip", 60, 5},
	"friendlink":        {"友链申请", "ip", 60, 3},
	"friendlink_code":   {"友链验证码", "ip", 60, 5},
	"x-preview-minute":  {"外部推文预览分钟额度", "user", 60, 5},
	"x-preview-day":     {"外部推文预览滚动日额度", "user", 86400, 50},
	"x-refresh":         {"刷新外部推文", "user", 60, 5},
	"x-video":           {"外部推文视频", "ip", 60, 600},
	"chat-appearance":   {"聊天外观更新", "ip", 60, 30},
	"mcp":               {"文章 MCP", "ip", 60, 60},
	"mcp-scraper":       {"抓取 MCP", "ip", 60, 30},
	"mcp-notes":         {"笔记 MCP", "ip", 60, 60},
	"mcp-roadmap":       {"路线图 MCP", "ip", 60, 60},
	"mcp-reader":        {"公开阅读 MCP", "ip", 60, 120},
	"mcp-comments":      {"评论 MCP", "ip", 60, 60},
	"omp-usage":         {"OMP 用量上报", "user", 60, 60},
	"chat-bot-commands": {"机器人指令更新", "user", 60, 30},
	"chat-bot-media":    {"机器人媒体上传", "user", 60, 20},
	"chat-bot-send":     {"机器人发送消息", "user", 60, 60},
	"chat-bot-edit":     {"机器人编辑消息", "user", 60, 300},
	"chat-bot-typing":   {"机器人输入状态", "user", 60, 120},
	"music_public":      {"公开音乐查询", "ip", 60, 60},
	"music_playback":    {"音乐播放取链", "ip", 60, 20},
	"music_resolve":     {"站点音乐解析总额度", "shared", 60, 30},
	"site-impressions":  {"站点印象投票", "hashed_ip", 60, 10},
	"image_processing":  {"图片处理与读取", "ip", 60, 60},
}

func (d *Deps) limit(id string, endpoints ...string) func(http.Handler) http.Handler {
	return d.limits([]string{id}, endpoints...)
}

func (d *Deps) limits(ids []string, endpoints ...string) func(http.Handler) http.Handler {
	if d.RateLimits == nil {
		d.RateLimits = middleware.NewRateLimiter(d.Redis, nil)
	}
	bindings := make([]middleware.RateLimitBinding, len(ids))
	for index, id := range ids {
		bindings[index] = d.rateBinding(id, endpoints)
	}
	return d.RateLimits.BindGroup(bindings...)
}

func (d *Deps) rateBinding(id string, endpoints []string) middleware.RateLimitBinding {
	binding, ok := rateBindings[id]
	if !ok {
		panic("未声明的限流绑定：" + id)
	}
	identity := middleware.IPIdentity
	description := "按客户端 IP 独立计数；无法获取地址时归入 unknown。管理员同样受限。"
	switch binding.identity {
	case "user":
		identity = middleware.UserIdentity
		description = "按已认证用户独立计数；缺失身份时按 IP 计数。管理员同样受限。"
	case "shared":
		identity = middleware.SharedIdentity
		description = "所有请求共用站点额度，管理员同样受限。"
	case "hashed_ip":
		identity = d.SiteImpressionIdentity
		description = "按独立 HMAC 摘要后的客户端 IP 计数；不保存原始 IP。"
	}
	failureMode := "allow"
	if id == "image_processing" {
		description += "默认关闭以保持原公开图片访问语义；启用后也覆盖缓存命中和条件请求。"
		failureMode = "deny"
	}
	return middleware.RateLimitBinding{
		ID: id, Identity: identity,
		Defaults: shared.RateLimitPolicy{
			Enabled: id != "image_processing", WindowSeconds: binding.window,
			MaxRequests: binding.maximum, FailureMode: failureMode,
		},
		Metadata: domainsettings.RateLimitMetadata{
			Title: binding.title, Description: description, Identity: binding.identity, Endpoints: endpoints,
		},
	}
}
