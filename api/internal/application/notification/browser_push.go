// browser_push.go 定义站内通知的浏览器系统通知（Web Push）端口与落地路径映射。
//
// 与 SSE 推送（Notifier）互补：SSE 只覆盖页面打开着的标签页，Web Push 覆盖
// 页面在后台或已关闭的场景。两者由 PushingSubscriber 在写入通知后并行触发。
package notification

import (
	"context"

	domainnotification "blog-api/internal/domain/notification"
	domainshared "blog-api/internal/domain/shared"
)

// BrowserNotification 浏览器系统通知内容（application 层中立形态）。
type BrowserNotification struct {
	// SourceType 通知来源，供实现方按类型聚合 tag
	SourceType domainnotification.SourceType
	Title      string
	Body       string
	// URL 点击通知后打开的站内路径
	URL string
}

// BrowserPusher 浏览器系统通知推送端口。
//
// 实现方负责查订阅、加密发送与失效订阅清理；无订阅即静默跳过。
// 推送失败不回滚通知（通知已落 DB，铃铛仍可见）。
type BrowserPusher interface {
	PushBrowser(ctx context.Context, userID domainshared.ID, notification BrowserNotification)
}

// NoopBrowserPusher 空实现（未配置 VAPID 密钥或测试场景）。
type NoopBrowserPusher struct{}

// PushBrowser 丢弃推送请求。
func (NoopBrowserPusher) PushBrowser(context.Context, domainshared.ID, BrowserNotification) {}

// notificationURL 按来源类型与 payload 推导通知的落地路径。
//
// 推文互动落到推文详情页；聊天邀请落到对应会话；其余回落通知中心所在的首页。
// payload 键名与 subscriber 写入时保持一致，缺键时降级到兜底路径。
func notificationURL(sourceType domainnotification.SourceType, payload map[string]any) string {
	switch sourceType {
	case domainnotification.SourceTweetLiked,
		domainnotification.SourceTweetQuoted,
		domainnotification.SourceTweetCommented,
		domainnotification.SourceTweetCommentReplied:
		if id, ok := payload["tweet_id"].(string); ok && id != "" {
			return "/tweets/" + id
		}
		return "/tweets"
	case domainnotification.SourceChatRoomInvited:
		if id, ok := payload["conversation_id"].(string); ok && id != "" {
			return "/chat?c=" + id
		}
		return "/chat"
	default:
		return "/"
	}
}
