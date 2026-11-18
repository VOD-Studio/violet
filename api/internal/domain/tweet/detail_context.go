package tweet

import (
	"context"
	"time"

	"blog-api/internal/domain/shared"
)

// DetailContextRepository 查询匿名可见的推文详情上下文。
type DetailContextRepository interface {
	// ReadDetailContext 对不存在或不可公开访问的推文返回 ErrNotFound。
	ReadDetailContext(ctx context.Context, id shared.ID) (DetailContext, error)
}

// DetailContextProfile 详情上下文使用的公开身份资料。
type DetailContextProfile struct {
	// Username 用户主页路径名。
	Username string
	// DisplayName 用户公开昵称，未设置时为空。
	DisplayName string
	// AvatarURL 公开头像，未设置时为空。
	AvatarURL string
}

// DetailContextAuthor 详情主推文的作者及其累计公开数据。
type DetailContextAuthor struct {
	DetailContextProfile
	// Bio 作者公开简介，未设置时为空。
	Bio string
	// TweetCount 该作者全部当前公开推文的数量。
	TweetCount int64
	// ReceivedLikeCount 这些推文各自点赞数的总和，同一用户可贡献多次。
	ReceivedLikeCount int64
}

// DetailContextQuote 直接引用主推文的公开推文摘要。
type DetailContextQuote struct {
	DetailContextProfile
	// ID 引用者发布的推文 ID，不是被引用的目标 ID。
	ID shared.ID
	// Content 引用推文自身的正文，不含引用快照；纯引用可以为空。
	Content string
	// CreatedAt 引用推文的发布时间。
	CreatedAt time.Time
}

// DetailContext 聚合公开推文详情右栏所需的数据。
type DetailContext struct {
	// Author 主推文的公开作者资料及统计。
	Author DetailContextAuthor
	// Quotes 最近至多六条公开的直接引用，按发布时间、ID 降序。
	Quotes []DetailContextQuote
}
