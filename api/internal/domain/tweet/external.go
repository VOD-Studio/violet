package tweet

import (
	"context"
	"net/url"
	"regexp"
	"strings"
	"time"

	"blog-api/internal/domain/shared"
)

const (
	ExternalAvailable   = "available"
	ExternalUnavailable = "unavailable"
	ExternalDeleted     = "deleted"
	ExternalPrivate     = "private"
	TextComplete        = "complete"
	TextPartial         = "partial"
	TextUnknown         = "unknown"
)

var sourceIDPattern = regexp.MustCompile(`^[1-9][0-9]{0,19}$`)
var sourceHandlePattern = regexp.MustCompile(`^[A-Za-z0-9_]{1,15}$`)
var sourcePathPattern = regexp.MustCompile(`^/(?:[A-Za-z0-9_]{1,15}/status|i/status|i/web/status)/([1-9][0-9]{0,19})(?:/(?:photo|video)/[1-9][0-9]*)?/?$`)

// ParseXURL 只提取白名单链接中的字符串 ID；调用方据此构造固定数据源地址。
func ParseXURL(raw string) (string, error) {
	if len(raw) > 2048 {
		return "", shared.NewError("EXTERNAL_INVALID_URL", "推文链接过长")
	}
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme != "https" || u.User != nil || u.Opaque != "" || (u.Port() != "" && u.Port() != "443") {
		return "", shared.NewError("EXTERNAL_INVALID_URL", "请提供完整的 HTTPS X 推文链接")
	}
	switch strings.ToLower(u.Hostname()) {
	case "x.com", "www.x.com", "mobile.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com":
	default:
		return "", shared.NewError("EXTERNAL_INVALID_URL", "仅支持 x.com 或 twitter.com 的完整推文链接")
	}
	if u.RawPath != "" {
		return "", shared.NewError("EXTERNAL_INVALID_URL", "不支持经过编码的推文路径")
	}
	m := sourcePathPattern.FindStringSubmatch(u.Path)
	if m == nil {
		return "", shared.NewError("EXTERNAL_INVALID_URL", "链接中没有可识别的推文 ID")
	}
	return m[1], nil
}

func ValidXID(id string) bool         { return sourceIDPattern.MatchString(id) }
func ValidXHandle(handle string) bool { return sourceHandlePattern.MatchString(handle) }

// XCanonicalURL 作者未知时使用 ID 路径，不采信用户输入的用户名。
func XCanonicalURL(id, handle string) string {
	if !ValidXHandle(handle) {
		return "https://x.com/i/status/" + id
	}
	return "https://x.com/" + handle + "/status/" + id
}

type ExternalAuthor struct {
	// ID X 作者 ID，始终为字符串。
	ID string `json:"id"`
	// Name 来源显示名，不创建本站账号。
	Name string `json:"name"`
	// Handle 来源用户名，不含 @。
	Handle string `json:"handle"`
	// URL 已规范化的 X 作者页面。
	URL string `json:"url"`
	// AvatarSourceURL 来源头像地址，仅供服务端重新保存。
	AvatarSourceURL string `json:"avatar_source_url,omitempty"`
	// AvatarURL 本站头像；空串时使用文字占位。
	AvatarURL string `json:"avatar_url"`
	// Verified nil 表示来源没有提供认证信息。
	Verified *bool `json:"verified,omitempty"`
}

type ExternalSegment struct {
	// Kind text、link、mention 或 hashtag；不参与本站表情和话题解析。
	Kind string `json:"kind"`
	// Text 安全的纯文本片段。
	Text string `json:"text"`
	// URL 仅在受控的链接片段上非空。
	URL string `json:"url,omitempty"`
}

type ExternalMedia struct {
	// Kind photo、video 或 animated_gif；后两者只保存封面。
	Kind string `json:"kind"`
	// SourceURL 经白名单校验后下载的图片或封面地址。
	SourceURL string `json:"source_url"`
	// URL 本站文件地址。
	URL string `json:"url"`
	// ThumbnailURL 本站缩略图地址，未生成时为空。
	ThumbnailURL string `json:"thumbnail_url,omitempty"`
	// Width 实际解码后的像素宽度。
	Width int `json:"width"`
	// Height 实际解码后的像素高度。
	Height int `json:"height"`
	// Alt 来源提供的替代文本。
	Alt string `json:"alt"`
	// FileID 共享资产标识，不属于用户上传文件。
	FileID string `json:"file_id"`
}

type ExternalSnapshot struct {
	// Author 原作者身份。
	Author ExternalAuthor `json:"author"`
	// Text 去除明确媒体占位后的正文。
	Text string `json:"text"`
	// Segments 文本与受控链接，不含第三方 HTML。
	Segments []ExternalSegment `json:"segments"`
	// PublishedAt 原文发布时间，与本站转发时间独立。
	PublishedAt time.Time `json:"published_at"`
	// Completeness complete、partial 或 unknown；只有 complete 可发布。
	Completeness string `json:"completeness"`
	// Media 原文媒体，不计入本站用户上传限额。
	Media []ExternalMedia `json:"media"`
	// Warnings 无法完整呈现的投票、文章等内容提示。
	Warnings []string `json:"warnings"`
	// QuoteURL 更深引用只保留链接，不持久化另一份正文。
	QuoteURL string `json:"quote_url,omitempty"`
}

type ExternalTweet struct {
	// ID 本站共享原文 UUID。
	ID shared.ID
	// SourceID X 推文 ID，与 platform=x 唯一。
	SourceID string
	// CanonicalURL 已校验来源身份后的原文地址。
	CanonicalURL string
	// Snapshot nil 表示仅有来源占位，不能展示旧内容。
	Snapshot *ExternalSnapshot
	// QuotedID 一层引用的独立共享记录，可统一撤回。
	QuotedID *shared.ID
	// FetchSource fxtwitter 或 syndication。
	FetchSource string
	// Version 快照 UUID，绑定预览与资产目录。
	Version string
	// Fingerprint 规范化来源数据的哈希，不含互动计数和本地地址。
	Fingerprint string
	// Availability available、unavailable、deleted 或 private。
	Availability string
	// FetchedAt 当前有效快照获取时间。
	FetchedAt time.Time
	// LastCheckedAt 最近一次检查时间，包括失败。
	LastCheckedAt time.Time
	// LastError 仅保存脱敏错误类别。
	LastError string
	// ProtectedUntil 活跃预览和导入的保留期限，回收时再次原子检查。
	ProtectedUntil time.Time
	// TakenDown 已确认撤回的来源不允许自动重新导入或被嵌入引用恢复。
	TakenDown bool
}

func (t *ExternalTweet) CanPublish() bool {
	return t != nil && !t.TakenDown && t.Availability == ExternalAvailable && t.Snapshot != nil && t.Snapshot.Completeness == TextComplete
}

// ExternalRepository 将发布、刷新和回收的并发检查保留在持久化边界。
type ExternalRepository interface {
	Ensure(context.Context, string, time.Time) (*ExternalTweet, error)
	FindByID(context.Context, shared.ID) (*ExternalTweet, error)
	FindByIDs(context.Context, []shared.ID) ([]*ExternalTweet, error)
	SaveSnapshot(context.Context, *ExternalTweet, string) (bool, error)
	RecordFailure(context.Context, shared.ID, string, time.Time) error
	Withdraw(context.Context, shared.ID, string, time.Time) error
	Protect(context.Context, []shared.ID, time.Time) error
	FindDue(context.Context, time.Time, int) ([]*ExternalTweet, error)
	FindUnused(context.Context, time.Time, int) ([]*ExternalTweet, error)
	DeleteUnused(context.Context, shared.ID, time.Time) (bool, error)
	AssetVersions(context.Context) (map[string]string, error)
}

type Publication struct {
	// ExternalTweetID 外部原文关联，与 quote_of 互斥。
	ExternalTweetID *shared.ID
	// ClientRequestID 用户本次发布 UUID，旧客户端可省略。
	ClientRequestID *shared.ID
	// RequestHash 同键不同内容的冲突检查摘要。
	RequestHash string
	// PreviewTokenHash 防止同一凭证以不同请求 ID 重复发布。
	PreviewTokenHash *string
}

type ExternalPreviewBinding struct {
	// UserID 唯一可使用该预览的本站用户。
	UserID string `json:"user_id"`
	// ExternalID 原文记录 ID。
	ExternalID string `json:"external_id"`
	// Version 用户确认的原文版本。
	Version string `json:"version"`
	// QuotedID 用户看到的一层引用记录。
	QuotedID string `json:"quoted_id,omitempty"`
	// QuotedVersion 用户确认的一层引用版本。
	QuotedVersion string `json:"quoted_version,omitempty"`
	// ExpiresAt 服务端凭证截止时间。
	ExpiresAt time.Time `json:"expires_at"`
}

// PublicationRepository 在同一事务内校验预览版本并创建幂等发布记录。
type PublicationRepository interface {
	FindByRequestID(context.Context, shared.ID, shared.ID) (*Tweet, error)
	Publish(context.Context, *Tweet, *ExternalPreviewBinding) (*Tweet, bool, error)
}
