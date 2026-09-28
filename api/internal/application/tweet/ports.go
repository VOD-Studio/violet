package tweet

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
	domaintweet "blog-api/internal/domain/tweet"
)

// TweetImageChecker 推文图片归属校验端口。
//
// 发布时校验每个 image URL 在 upload 域存在、就绪且归属作者，
// 防越权引用他人上传文件（生产实现适配 upload.FileRepository）。
type TweetImageChecker interface {
	// CheckImagesOwnedBy 校验 urls 全部存在、就绪且 owner 为 authorID。
	// 任一不满足返回错误（不存在/未就绪/非本人同错，不暴露他人文件存在性）。
	CheckImagesOwnedBy(ctx context.Context, urls []string, authorID shared.ID) error
}

// TweetPermissionChecker 检查当前角色的推文权限。
type TweetPermissionChecker interface {
	HasPermission(role string, isBuiltinSuperAdmin bool, codes ...string) bool
}

type ExternalFetchResult struct {
	SourceID     string
	CanonicalURL string
	Snapshot     *domaintweet.ExternalSnapshot
	Quote        *ExternalFetchResult
	// Availability 引用 tombstone 可只携带来源与可用状态。
	Availability string
	FetchSource  string
}

// ExternalFetchError 只携带诊断类别，不暴露响应体、Cookie 或上游地址中的参数。
type ExternalFetchError struct {
	Kind       string
	RetryAfter time.Duration
	// StopFallback 删除、私密或访问限制不得被回退源的旧数据覆盖。
	StopFallback bool
}

func (e *ExternalFetchError) Error() string { return e.Kind }

type ExternalFetcher interface {
	Fetch(context.Context, string) (*ExternalFetchResult, error)
}

type ExternalMediaStore interface {
	Prepare(context.Context, string, string, *domaintweet.ExternalSnapshot, *int64) error
	DeleteVersion(context.Context, string, string) error
	DeleteAll(context.Context, string) error
	Sweep(context.Context, map[string]string, time.Time) error
}

type ExternalPreviewStore interface {
	Put(context.Context, string, domaintweet.ExternalPreviewBinding, time.Duration) error
	Get(context.Context, string) (*domaintweet.ExternalPreviewBinding, error)
	GetFailure(context.Context, string) (*ExternalFetchError, error)
	PutFailure(context.Context, string, *ExternalFetchError, time.Duration) error
}
