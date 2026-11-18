package friendlink

import (
	"context"
	"net"
	"net/url"
	"strings"
	"time"

	"blog-api/internal/domain/shared"
)

const (
	FeedNone      = "no_feed"
	FeedPending   = "pending"
	FeedOK        = "ok"
	FeedEmpty     = "empty"
	FeedError     = "error"
	SiteUnchecked = "unchecked"
	SiteUp        = "up"
	SiteDown      = "down"
)

// Activity 是已审核友链的持久化抓取快照；抓取失败保留最后成功的文章。
type Activity struct {
	// FeedStatus 独立于站点健康的 RSS 结果。
	FeedStatus string
	// SiteStatus 站点首页的可达性。
	SiteStatus string
	// CheckedAt 本轮探测的时间，不用于文章排序。
	CheckedAt *time.Time
	// LatestTitle 最近一篇具有安全 HTTP 链接的文章标题。
	LatestTitle string
	// LatestURL 最近文章的外站链接。
	LatestURL string
	// LatestPublishedAt 源站提供的真实日期；缺失时不捏造。
	LatestPublishedAt *time.Time
}

// ActivityRepository 分批领取已审核站点，保存时校验 URL 与审核状态，防止旧请求覆盖编辑。
type ActivityRepository interface {
	ClaimRefreshBatch(ctx context.Context, now time.Time, limit int) ([]*FriendLink, error)
	SaveActivity(ctx context.Context, link *FriendLink, activity Activity) error
}

func validateRSSURL(raw string) error {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	if len(raw) > 2048 {
		return shared.BadRequest("RSS 地址不能超过 2048 字节")
	}
	if err := validateHTTPURL(raw, "RSS 地址"); err != nil {
		return err
	}
	u, _ := url.Parse(strings.TrimSpace(raw))
	if u.User != nil || u.Fragment != "" {
		return shared.BadRequest("RSS 地址不能包含用户名、密码或片段")
	}
	if ip := net.ParseIP(u.Hostname()); ip != nil && (ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsUnspecified() || ip.IsMulticast()) {
		return shared.BadRequest("RSS 地址必须指向公开站点")
	}
	return nil
}

// SetRSSURL 设置手动创建的 RSS 地址；更新操作通过 Update 记录字段变更。
func (f *FriendLink) SetRSSURL(raw string) error {
	if err := validateRSSURL(raw); err != nil {
		return err
	}
	f.rssURL = strings.TrimSpace(raw)
	return nil
}

// ReconstructActivity 由持久化适配器恢复快照，不产生业务事件。
func (f *FriendLink) ReconstructActivity(rssURL string, activity Activity) {
	f.rssURL, f.activity = rssURL, activity
}

func (f *FriendLink) RSSURL() string { return f.rssURL }

func (f *FriendLink) Activity() Activity {
	activity := f.activity
	if activity.FeedStatus == "" {
		activity.FeedStatus = FeedPending
	}
	if f.rssURL == "" {
		activity.FeedStatus = FeedNone
	}
	if activity.SiteStatus == "" {
		activity.SiteStatus = SiteUnchecked
	}
	return activity
}
